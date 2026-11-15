"""SQLite con transacciones, propiedad de partidas e idempotencia persistente."""
import hashlib
import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from importlib.resources import files
from pathlib import Path
from uuid import uuid4

from .engine import new_mission, transition, view, evaluate
from .errors import MissionError
from .models import (Command, CreateMission, EventList, MissionList, MissionState, MissionSummary,
                     MutationResult, ScienceBundle, SessionCreated, SessionInfo, StoredEvent, TimelineEvent,
                     MissionComparison, DecisionDifference)


def fingerprint(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class Store:
    def __init__(self, path: Path, max_active: int = 20):
        self.path, self.max_active = path, max_active
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as c:
            c.execute("PRAGMA journal_mode=WAL")
            version = c.execute("PRAGMA user_version").fetchone()[0]
            if version > 1:
                raise RuntimeError("La base de datos requiere una versión más reciente del backend.")
            if version < 1:
                migration = files("mission_api").joinpath("migrations/001_initial.sql").read_text(encoding="utf-8")
                c.executescript("BEGIN IMMEDIATE;\n" + migration + "\nCOMMIT;")

    @contextmanager
    def connection(self, write=False):
        c = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA foreign_keys=ON")
        c.execute("PRAGMA busy_timeout=10000")
        try:
            if write:
                c.execute("BEGIN IMMEDIATE")
            yield c
            if c.in_transaction:
                c.commit()
        except BaseException:
            if c.in_transaction:
                c.rollback()
            raise
        finally:
            c.close()

    def ready(self) -> bool:
        try:
            with self.connection() as c:
                return c.execute("PRAGMA user_version").fetchone()[0] == 1 and c.execute("SELECT 1 FROM sessions LIMIT 1").fetchall() is not None
        except sqlite3.Error:
            return False

    def rate_limit(self, namespace: str, key: str, limit: int, window: int, now: datetime) -> int:
        timestamp = int(now.timestamp())
        bucket = timestamp // window
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        with self.connection(write=True) as c:
            c.execute("DELETE FROM rate_limits WHERE expires_at <= ?", (timestamp,))
            c.execute("INSERT INTO rate_limits VALUES (?, ?, ?, ?, 1) ON CONFLICT(namespace,key_hash,bucket) DO UPDATE SET counter=counter+1",
                      (namespace, key_hash, bucket, (bucket + 1) * window))
            count = c.execute("SELECT counter FROM rate_limits WHERE namespace=? AND key_hash=? AND bucket=?",
                              (namespace, key_hash, bucket)).fetchone()[0]
        return (bucket + 1) * window - timestamp if count > limit else 0

    def create_session(self, now: datetime, hours: int) -> SessionCreated:
        token, session_id = secrets.token_urlsafe(40), str(uuid4())
        expires = now + timedelta(hours=hours)
        with self.connection(write=True) as c:
            c.execute("INSERT INTO sessions(id,token_hash,created_at,expires_at) VALUES (?,?,?,?)",
                      (session_id, hashlib.sha256(token.encode()).hexdigest(), now.timestamp(), expires.timestamp()))
        return SessionCreated(session_id=session_id, access_token=token, created_at=now, expires_at=expires)

    def authenticate(self, token: str, now: datetime) -> SessionInfo:
        if not 32 <= len(token) <= 256:
            raise MissionError("UNAUTHORIZED", "Se requiere una sesión válida.", 401)
        with self.connection() as c:
            row = c.execute("SELECT * FROM sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?",
                            (hashlib.sha256(token.encode()).hexdigest(), now.timestamp())).fetchone()
        if row is None:
            raise MissionError("UNAUTHORIZED", "La sesión no existe, expiró o fue cerrada.", 401)
        return SessionInfo(session_id=row["id"], created_at=datetime.fromtimestamp(row["created_at"], UTC),
                           expires_at=datetime.fromtimestamp(row["expires_at"], UTC))

    def _authorize(self, c, owner, now):
        if c.execute("SELECT 1 FROM sessions WHERE id=? AND revoked_at IS NULL AND expires_at>?", (owner, now.timestamp())).fetchone() is None:
            raise MissionError("UNAUTHORIZED", "La sesión no existe, expiró o fue cerrada.", 401)

    def revoke(self, owner: str, now: datetime):
        with self.connection(write=True) as c:
            self._authorize(c, owner, now)
            c.execute("UPDATE sessions SET revoked_at=? WHERE id=?", (now.timestamp(), owner))

    def _receipt(self, c, owner, scope, key, digest):
        row = c.execute("SELECT fingerprint,payload FROM command_receipts WHERE owner_id=? AND scope=? AND command_key=?", (owner, scope, key)).fetchone()
        if row is None:
            return None
        if row["fingerprint"] != digest:
            raise MissionError("IDEMPOTENCY_CONFLICT", "Idempotency-Key ya se usó con otra solicitud.")
        return MutationResult.model_validate_json(row["payload"])

    def receipt(self, owner, scope, key, digest, now):
        with self.connection() as c:
            self._authorize(c, owner, now)
            return self._receipt(c, owner, scope, key, digest)

    def _save_receipt(self, c, owner, scope, key, digest, result):
        c.execute("INSERT INTO command_receipts VALUES(?,?,?,?,?)", (owner, scope, key, digest, result.model_dump_json()))

    def _ensure_capacity(self, c, owner):
        count = c.execute("SELECT count(*) FROM missions WHERE owner_id=? AND status IN ('active','paused')", (owner,)).fetchone()[0]
        if count >= self.max_active:
            raise MissionError("MISSION_LIMIT", "Finaliza o abandona una misión antes de crear otra.")

    def _state(self, c, owner, mission_id) -> MissionState:
        row = c.execute("SELECT payload FROM missions WHERE id=? AND owner_id=?", (mission_id, owner)).fetchone()
        if row is None:
            raise MissionError("MISSION_NOT_FOUND", "No se encontró esa misión en tu sesión.", 404)
        return MissionState.model_validate_json(row["payload"])

    def _insert(self, c, owner, s):
        c.execute("INSERT INTO missions VALUES(?,?,?,?,?,?,?)", (s.id, owner, s.science_bundle_id, s.version,
                  s.status, s.updated_at.timestamp(), s.model_dump_json()))

    def _events(self, c, s, events):
        sequence = c.execute("SELECT COALESCE(max(sequence),0) FROM mission_events WHERE mission_id=?", (s.id,)).fetchone()[0]
        for event in events:
            sequence += 1
            c.execute("INSERT INTO mission_events VALUES(?,?,?,?)", (s.id, sequence, s.version, event.model_dump_json()))

    def create_mission(self, owner: str, config: CreateMission, bundle: ScienceBundle, key: str, digest: str, now: datetime):
        with self.connection(write=True) as c:
            self._authorize(c, owner, now)
            existing = self._receipt(c, owner, "create", key, digest)
            if existing:
                return existing
            self._ensure_capacity(c, owner)
            derivation = bundle.model_derivations.get("mars_radiation")
            state = new_mission(str(uuid4()), config, bundle.id, now,
                                radiation_profile=derivation["values"] if derivation else None,
                                profile_hash="normalized_sha256:" + derivation["normalized_records_sha256"] if derivation else None)
            c.execute("INSERT OR IGNORE INTO science_bundles VALUES(?,?)", (bundle.id, bundle.model_dump_json()))
            self._insert(c, owner, state)
            events = [TimelineEvent(type="mission_created", turn=0, message="Misión creada con referencias científicas congeladas para esta partida.", occurred_at=now)]
            self._events(c, state, events)
            result = MutationResult(mission=view(state), events=events)
            self._save_receipt(c, owner, "create", key, digest, result)
            return result

    def get(self, owner, mission_id, now) -> MissionState:
        with self.connection() as c:
            self._authorize(c, owner, now)
            return self._state(c, owner, mission_id)

    def list_missions(self, owner, limit, offset, now) -> MissionList:
        with self.connection() as c:
            c.execute("BEGIN")
            self._authorize(c, owner, now)
            total = c.execute("SELECT count(*) FROM missions WHERE owner_id=?", (owner,)).fetchone()[0]
            rows = c.execute("SELECT payload FROM missions WHERE owner_id=? ORDER BY updated_at DESC,id LIMIT ? OFFSET ?", (owner, limit, offset)).fetchall()
        states = [MissionState.model_validate_json(row[0]) for row in rows]
        return MissionList(data=[MissionSummary(**s.model_dump(include={"id", "scenario_id", "status", "version", "turn", "updated_at"})) for s in states], total=total, limit=limit, offset=offset)

    def command(self, owner, mission_id, command: Command, key, digest, now):
        with self.connection(write=True) as c:
            self._authorize(c, owner, now)
            existing = self._receipt(c, owner, mission_id, key, digest)
            if existing:
                return existing
            state = self._state(c, owner, mission_id)
            result = transition(state, command, now)
            updated = result.mission.state
            c.execute("UPDATE missions SET version=?,status=?,updated_at=?,payload=? WHERE id=? AND owner_id=? AND version=?",
                      (updated.version, updated.status, now.timestamp(), updated.model_dump_json(), mission_id, owner, state.version))
            self._events(c, updated, result.events)
            self._save_receipt(c, owner, mission_id, key, digest, result)
            return result

    def restart(self, owner, mission_id, expected_version, key, digest, now):
        scope = "restart:" + mission_id
        with self.connection(write=True) as c:
            self._authorize(c, owner, now)
            existing = self._receipt(c, owner, scope, key, digest)
            if existing:
                return existing
            old = self._state(c, owner, mission_id)
            if old.version != expected_version:
                raise MissionError("VERSION_CONFLICT", "Consulta la versión actual antes de reiniciar.")
            self._ensure_capacity(c, owner)
            config = CreateMission(scenario_id=old.scenario_id, difficulty=old.difficulty, seed=old.seed, practice_mode=old.practice_mode)
            state = new_mission(str(uuid4()), config, old.science_bundle_id, now, parent_id=old.id,
                                rules_version=old.rules_version, radiation_profile=old.radiation_profile_ugy_h,
                                profile_hash=old.radiation_profile_source_hash)
            self._insert(c, owner, state)
            events = [TimelineEvent(type="mission_restarted", turn=0, message="Nueva misión con la misma semilla y referencias; la anterior se conserva.", occurred_at=now, payload={"parent_mission_id": old.id})]
            self._events(c, state, events)
            result = MutationResult(mission=view(state), events=events)
            self._save_receipt(c, owner, scope, key, digest, result)
            return result

    def events(self, owner, mission_id, limit, offset, now) -> EventList:
        with self.connection() as c:
            c.execute("BEGIN")
            self._authorize(c, owner, now)
            self._state(c, owner, mission_id)
            total = c.execute("SELECT count(*) FROM mission_events WHERE mission_id=?", (mission_id,)).fetchone()[0]
            rows = c.execute("SELECT * FROM mission_events WHERE mission_id=? ORDER BY sequence LIMIT ? OFFSET ?", (mission_id, limit, offset)).fetchall()
        return EventList(data=[StoredEvent(sequence=r["sequence"], mission_version=r["mission_version"], event=TimelineEvent.model_validate_json(r["payload"])) for r in rows], total=total, limit=limit, offset=offset)

    def science(self, owner, mission_id, now) -> ScienceBundle:
        with self.connection() as c:
            self._authorize(c, owner, now)
            row = c.execute("SELECT b.payload FROM science_bundles b JOIN missions m ON m.bundle_id=b.id WHERE m.id=? AND m.owner_id=?", (mission_id, owner)).fetchone()
        if row is None:
            raise MissionError("MISSION_NOT_FOUND", "No se encontró esa misión en tu sesión.", 404)
        return ScienceBundle.model_validate_json(row[0])


    def evaluation(self, owner, mission_id, now):
        with self.connection() as c:
            c.execute("BEGIN")
            self._authorize(c, owner, now)
            current = self._state(c, owner, mission_id)
            result = evaluate(current)
            if not current.parent_mission_id or not result.final:
                return result
            previous = self._state(c, owner, current.parent_mission_id)
            if (not evaluate(previous).final or
                    any(getattr(previous, key) != getattr(current, key) for key in
                        ("seed", "scenario_id", "rules_version", "science_bundle_id", "difficulty", "practice_mode", "radiation_profile_ugy_h"))):
                return result
            def decisions(mission):
                out = {}
                for row in c.execute("SELECT payload FROM mission_events WHERE mission_id=? ORDER BY sequence", (mission.id,)):
                    event = json.loads(row[0])
                    if event["type"] == "action_applied":
                        out.setdefault(event["turn"], []).append(event["payload"]["action_id"])
                return out
            before, after = decisions(previous), decisions(current)
            result.comparison = MissionComparison(
                previous_mission_id=previous.id, previous_turns=previous.turn, current_turns=current.turn,
                score_delta=result.score - evaluate(previous).score,
                health_delta=round(current.crew_health_pct - previous.crew_health_pct, 4),
                exposure_delta=round(current.exposure_risk_index - previous.exposure_risk_index, 4),
                food_delta_kg=round(current.resources.food_kg - previous.resources.food_kg, 4),
                energy_delta_kwh=round(current.resources.energy_kwh - previous.resources.energy_kwh, 4),
                decisions=[DecisionDifference(turn=t, previous=before.get(t, []), current=after.get(t, []))
                           for t in sorted(before.keys() | after.keys()) if before.get(t, []) != after.get(t, [])])
            return result
