from contextlib import closing
import asyncio
import json
import sqlite3
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import httpx
from pydantic import SecretStr

from mission_api.config import Settings
from mission_api.main import create_app
from resource_api.config import Settings as ResourceSettings
from resource_api.main import create_app as create_resource_app

SERVICE_TOKEN = "TEST-ONLY_p5rA8Nv2Wz6Lq0Uc1mT9Bf4Gd7Yh3KxS"


class HttpTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.resource_app = create_resource_app(ResourceSettings(api_token=SERVICE_TOKEN, cache_path=self.root / "resources.db", _env_file=None),
            transport=httpx.MockTransport(lambda request: httpx.Response(503)))
        self.resource_lifespan = self.resource_app.router.lifespan_context(self.resource_app)
        await self.resource_lifespan.__aenter__()
        self.settings = Settings(database_path=self.root / "missions.db", RESOURCE_API_TOKEN=SERVICE_TOKEN,
            allowed_hosts=["testserver"], requests_per_minute=10000, sessions_per_hour=1000, _env_file=None)
        self.app = create_app(self.settings, resource_transport=httpx.ASGITransport(app=self.resource_app))
        self.lifespan = self.app.router.lifespan_context(self.app)
        await self.lifespan.__aenter__()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://testserver")
        response = await self.client.post("/api/v1/sessions")
        self.session_data = response.json()
        self.auth = {"Authorization": "Bearer " + self.session_data["access_token"]}

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.lifespan.__aexit__(None, None, None)
        await self.resource_lifespan.__aexit__(None, None, None)
        self.tmp.cleanup()

    async def create(self, body=None, key=None, auth=None):
        return await self.client.post("/api/v1/missions", json=body or {"data_mode": "snapshot"},
            headers=(auth or self.auth) | {"Idempotency-Key": key or str(uuid4())})

    async def cmd(self, state, kind="advance", action=None, key=None, auth=None, version=None):
        body = {"type": kind, "expected_version": version or state["version"]}
        if action:
            body["action_id"] = action
        return await self.client.post(f'/api/v1/missions/{state["id"]}/commands', json=body,
            headers=(auth or self.auth) | {"Idempotency-Key": key or str(uuid4())})

    async def test_health_and_catalog(self):
        for path in ["/health/live", "/health/ready", "/api/v1/scenarios", "/api/v1/scenarios/lunar-outpost-v1"]:
            self.assertEqual((await self.client.get(path)).status_code, 200)
        self.assertEqual((await self.client.get("/api/v1/scenarios/missing")).status_code, 404)

    async def test_openapi_requires_response_defaults_but_allows_creation_defaults(self):
        schemas = self.app.openapi()["components"]["schemas"]
        self.assertIn("version", schemas["MissionState"]["required"])
        self.assertIn("turn", schemas["MissionState"]["required"])
        self.assertNotIn("seed", schemas["CreateMission"].get("required", []))

    async def test_unauthorized_and_service_token_is_not_player_token(self):
        self.assertEqual((await self.client.get("/api/v1/missions")).status_code, 401)
        response = await self.client.get("/api/v1/missions", headers={"Authorization": f"Bearer {SERVICE_TOKEN}"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")

    async def test_session_token_is_hashed_and_not_exposed_again(self):
        response = await self.client.get("/api/v1/sessions/me", headers=self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("access_token", response.json())
        with closing(sqlite3.connect(self.settings.database_path)) as c, c:
            stored = c.execute("SELECT token_hash FROM sessions").fetchone()[0]
        self.assertNotEqual(stored, self.session_data["access_token"])
        self.assertEqual(len(stored), 64)

    async def test_logout_revokes_token(self):
        self.assertEqual((await self.client.delete("/api/v1/sessions/current", headers=self.auth)).status_code, 204)
        self.assertEqual((await self.client.get("/api/v1/sessions/me", headers=self.auth)).status_code, 401)

    async def test_expired_token_is_rejected(self):
        with closing(sqlite3.connect(self.settings.database_path)) as c, c:
            c.execute("UPDATE sessions SET expires_at=0")
        self.assertEqual((await self.client.get("/api/v1/missions", headers=self.auth)).status_code, 401)

    async def test_create_calls_real_resource_service_with_snapshots(self):
        response = await self.create()
        self.assertEqual(response.status_code, 201, response.text)
        state = response.json()["mission"]["state"]
        self.assertEqual(response.headers["etag"], '"1"')
        science = (await self.client.get(f'/api/v1/missions/{state["id"]}/science', headers=self.auth)).json()
        self.assertEqual(len(science["sources"]), 3)
        self.assertTrue(science["historical_replay"])
        for source in science["sources"]:
            self.assertTrue(source["records"])
            self.assertEqual(source["pages_meta"][0]["retrieval_mode"], "snapshot")
        self.assertTrue(any(r.get("classification") == "X3.9" for r in science["sources"][0]["records"]))
        self.assertNotIn(SERVICE_TOKEN, json.dumps(science))

    async def test_create_retries_replay_without_resource_call(self):
        key = str(uuid4())
        first = await self.create(key=key)
        with patch.object(self.app.state.resources, "capture", side_effect=AssertionError("No debe consultar otra vez")):
            second = await self.create(key=key)
        self.assertEqual(first.json(), second.json())

    async def test_create_key_cannot_be_reused_with_different_input(self):
        key = str(uuid4())
        await self.create(key=key)
        response = await self.create({"seed": 123}, key=key)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "IDEMPOTENCY_CONFLICT")

    async def test_player_isolation_for_reads_commands_and_history(self):
        state = (await self.create()).json()["mission"]["state"]
        other = (await self.client.post("/api/v1/sessions")).json()
        auth = {"Authorization": "Bearer " + other["access_token"]}
        for suffix in ["", "/science", "/events", "/evaluation"]:
            self.assertEqual((await self.client.get(f'/api/v1/missions/{state["id"]}{suffix}', headers=auth)).status_code, 404)
        self.assertEqual((await self.cmd(state, auth=auth)).status_code, 404)
        self.assertEqual((await self.client.get("/api/v1/missions", headers=auth)).json()["total"], 0)

    async def test_command_retries_do_not_advance_twice(self):
        state = (await self.create()).json()["mission"]["state"]
        key = str(uuid4())
        first, second = await self.cmd(state, key=key), await self.cmd(state, key=key)
        self.assertEqual(first.json(), second.json())
        current = (await self.client.get(f'/api/v1/missions/{state["id"]}', headers=self.auth)).json()["state"]
        self.assertEqual(current["turn"], 1)
        self.assertEqual(current["version"], 2)

    async def test_concurrent_different_commands_use_one_version_once(self):
        state = (await self.create()).json()["mission"]["state"]
        responses = await asyncio.gather(self.cmd(state), self.cmd(state))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])
        current = (await self.client.get(f'/api/v1/missions/{state["id"]}', headers=self.auth)).json()["state"]
        self.assertEqual(current["turn"], 1)

    async def test_concurrent_identical_commands_replay(self):
        state = (await self.create()).json()["mission"]["state"]
        key = str(uuid4())
        responses = await asyncio.gather(*(self.cmd(state, key=key) for _ in range(4)))
        self.assertTrue(all(r.status_code == 200 for r in responses))
        self.assertTrue(all(r.json() == responses[0].json() for r in responses))

    async def test_preview_does_not_change_state_or_history(self):
        state = (await self.create()).json()["mission"]["state"]
        path = f'/api/v1/missions/{state["id"]}'
        preview = await self.client.post(path + "/preview", headers=self.auth, json={"action_id": "explore", "expected_version": 1})
        self.assertEqual(preview.status_code, 200)
        self.assertFalse(preview.json()["persisted"])
        self.assertEqual((await self.client.get(path, headers=self.auth)).json()["state"], state)
        self.assertEqual((await self.client.get(path + "/events", headers=self.auth)).json()["total"], 1)

    async def test_rejected_command_is_atomic(self):
        state = (await self.create()).json()["mission"]["state"]
        response = await self.cmd(state, "action", "repair_water_loop")
        self.assertEqual(response.status_code, 409)
        current = (await self.client.get(f'/api/v1/missions/{state["id"]}', headers=self.auth)).json()["state"]
        self.assertEqual(current, state)

    async def test_restart_preserves_old_mission_and_science(self):
        state = (await self.create()).json()["mission"]["state"]
        state = (await self.cmd(state)).json()["mission"]["state"]
        path = f'/api/v1/missions/{state["id"]}'
        key = str(uuid4())
        headers = self.auth | {"Idempotency-Key": key}
        with patch.object(self.app.state.resources, "capture", side_effect=AssertionError("No debe consultar la red")):
            response = await self.client.post(path + "/restart", headers=headers, json={"expected_version": state["version"]})
        self.assertEqual(response.status_code, 201, response.text)
        new = response.json()["mission"]["state"]
        self.assertNotEqual(new["id"], state["id"])
        self.assertEqual(new["parent_mission_id"], state["id"])
        self.assertEqual(new["science_bundle_id"], state["science_bundle_id"])
        self.assertEqual(new["turn"], 0)
        self.assertEqual((await self.client.get(path, headers=self.auth)).json()["state"], state)
        replay = await self.client.post(path + "/restart", headers=headers, json={"expected_version": state["version"]})
        self.assertEqual(response.json(), replay.json())

    async def test_missing_idempotency_key_and_unsafe_payloads_are_rejected(self):
        self.assertEqual((await self.client.post("/api/v1/missions", headers=self.auth, json={})).status_code, 422)
        for body in [{"seed": True}, {"seed": -1}, {"seed": "1"}, {"scenario_id": "mars"}, {"unknown": "field"}]:
            self.assertEqual((await self.create(body)).status_code, 422)
        state = (await self.create()).json()["mission"]["state"]
        response = await self.client.post(f'/api/v1/missions/{state["id"]}/commands', headers=self.auth | {"Idempotency-Key": str(uuid4())}, json={"type": "advance", "expected_version": True})
        self.assertEqual(response.status_code, 422)
        response = await self.client.post(f'/api/v1/missions/{state["id"]}/commands', headers=self.auth | {"Idempotency-Key": str(uuid4())}, json={"type": "advance", "expected_version": 1, "action_id": "explore"})
        self.assertEqual(response.status_code, 422)

    async def test_pagination_and_unknown_query(self):
        await self.create()
        await self.create()
        first = (await self.client.get("/api/v1/missions?limit=1", headers=self.auth)).json()
        second = (await self.client.get("/api/v1/missions?limit=1&offset=1", headers=self.auth)).json()
        self.assertEqual(first["total"], 2)
        self.assertNotEqual(first["data"][0]["id"], second["data"][0]["id"])
        self.assertEqual((await self.client.get("/api/v1/missions?limit=1000", headers=self.auth)).status_code, 422)
        self.assertEqual((await self.client.get("/api/v1/missions?owner=other", headers=self.auth)).status_code, 422)

    async def test_request_body_limit_applies_to_actual_chunks(self):
        async def chunks():
            yield b"a" * 9000
            yield b"a" * 9000
        response = await self.client.post("/api/v1/missions", headers=self.auth, content=chunks())
        self.assertEqual(response.status_code, 413)
        self.assertIn("x-request-id", response.headers)

    async def test_rate_limit_has_retry_after(self):
        self.settings.requests_per_minute = 2
        self.assertEqual((await self.client.get("/api/v1/scenarios")).status_code, 200)
        response = await self.client.get("/api/v1/scenarios")
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response.headers["retry-after"]), 0)

    async def test_rate_limit_storage_failure_returns_sanitized_503(self):
        with patch.object(self.app.state.store, "rate_limit", side_effect=sqlite3.OperationalError("private database path")):
            response = await self.client.get("/api/v1/scenarios")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "DATABASE_UNAVAILABLE")
        self.assertNotIn("private database path", response.text)

    async def test_cors_for_nextjs_and_rejected_origin(self):
        response = await self.client.options("/api/v1/missions", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Authorization,Idempotency-Key,Content-Type"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3000")
        response = await self.client.options("/api/v1/missions", headers={"Origin": "https://unknown.example", "Access-Control-Request-Method": "POST"})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)

    async def test_live_failure_does_not_fall_back_to_historical_snapshot(self):
        response = await self.create({"data_mode": "live"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual((await self.client.get("/api/v1/missions", headers=self.auth)).json()["total"], 0)

    async def test_http_failure_is_sanitized(self):
        transport = httpx.MockTransport(lambda request: httpx.Response(401, json={"secret": SERVICE_TOKEN}))
        async with httpx.AsyncClient(transport=transport, base_url="http://resources") as bad_client:
            from mission_api.resources import ResourceClient
            self.app.state.resources = ResourceClient(bad_client)
            response = await self.create()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(SERVICE_TOKEN, response.text)

    async def test_state_survives_new_application_instance(self):
        state = (await self.create()).json()["mission"]["state"]
        state = (await self.cmd(state)).json()["mission"]["state"]
        second_app = create_app(self.settings)
        async with second_app.router.lifespan_context(second_app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=second_app), base_url="http://testserver") as client:
                response = await client.get(f'/api/v1/missions/{state["id"]}', headers=self.auth)
        self.assertEqual(response.json()["state"], state)

    async def test_active_mission_limit(self):
        self.app.state.store.max_active = 1
        state = (await self.create()).json()["mission"]["state"]
        self.assertEqual((await self.create()).status_code, 409)
        await self.cmd(state, "abort")
        self.assertEqual((await self.create()).status_code, 201)

    async def test_complete_mission_over_http(self):
        state = (await self.create()).json()["mission"]["state"]
        async def act(action):
            nonlocal state
            response = await self.cmd(state, "action", action)
            self.assertEqual(response.status_code, 200, response.text)
            state = response.json()["mission"]["state"]
        await act("explore")
        await act("explore")
        for turn in range(12):
            actions = {2: "repair_water_loop", 5: "enter_shelter", 6: "leave_shelter", 8: "repair_solar_panels"}
            if turn in actions:
                await act(actions[turn])
            response = await self.cmd(state)
            self.assertEqual(response.status_code, 200, response.text)
            state = response.json()["mission"]["state"]
        evaluation = (await self.client.get(f'/api/v1/missions/{state["id"]}/evaluation', headers=self.auth)).json()
        self.assertEqual(evaluation["outcome"], "success")
        events = (await self.client.get(f'/api/v1/missions/{state["id"]}/events?limit=100', headers=self.auth)).json()
        self.assertEqual([e["sequence"] for e in events["data"]], list(range(1, events["total"] + 1)))
        self.assertTrue(any(e["event"]["type"] == "solar_incident" for e in events["data"]))
        self.assertEqual((await self.cmd(state)).status_code, 409)

    async def test_forecast_matches_confirmed_next_turn_without_preview_writes(self):
        state = (await self.create()).json()["mission"]["state"]
        path = f'/api/v1/missions/{state["id"]}'
        response = await self.client.post(path + "/preview", headers=self.auth,
            json={"action_id": "toggle_oxygen_generator", "expected_version": state["version"]})
        self.assertEqual(response.status_code, 200, response.text)
        forecast = response.json()["forecast"]
        self.assertEqual(forecast["with_action"]["mission"]["state"]["resources"]["oxygen_kg"], 2.52)
        self.assertEqual(forecast["without_action"]["mission"]["state"]["resources"]["oxygen_kg"], 2.92)
        self.assertEqual((await self.client.get(path + "/events", headers=self.auth)).json()["total"], 1)
        state = (await self.cmd(state, "action", "toggle_oxygen_generator")).json()["mission"]["state"]
        actual = (await self.cmd(state)).json()["mission"]["state"]
        self.assertEqual(actual["resources"], forecast["with_action"]["mission"]["state"]["resources"])
        self.assertEqual(actual["crew_health_pct"], forecast["with_action"]["mission"]["state"]["crew_health_pct"])

    async def test_mars_profile_is_derived_from_the_frozen_science_bundle(self):
        response = await self.create({"scenario_id": "mars-outpost-v1", "data_mode": "snapshot"})
        self.assertEqual(response.status_code, 201, response.text)
        state = response.json()["mission"]["state"]
        science = (await self.client.get(f'/api/v1/missions/{state["id"]}/science', headers=self.auth)).json()
        derivation = science["model_derivations"]["mars_radiation"]
        self.assertEqual(state["radiation_profile_ugy_h"], derivation["values"])
        self.assertEqual(state["radiation_profile_source_hash"], "normalized_sha256:" + derivation["normalized_records_sha256"])
        self.assertEqual(sum(derivation["counts"]), 139)

    async def test_trusted_proxy_separates_visitors_while_rejecting_spoofed_headers(self):
        self.settings.sessions_per_hour = 1
        self.settings.proxy_token = SecretStr(SERVICE_TOKEN)
        for _ in range(25):
            response = await self.client.post("/api/v1/sessions", headers={
                "X-Orbita-Proxy-Token": SERVICE_TOKEN, "X-Orbita-Visitor": str(uuid4())})
            self.assertEqual(response.status_code, 201, response.text)
        visitor = str(uuid4())
        headers = {"X-Orbita-Proxy-Token": SERVICE_TOKEN, "X-Orbita-Visitor": visitor}
        self.assertEqual((await self.client.post("/api/v1/sessions", headers=headers)).status_code, 201)
        self.assertEqual((await self.client.post("/api/v1/sessions", headers=headers)).status_code, 429)
        self.assertEqual((await self.client.post("/api/v1/sessions", headers={"X-Orbita-Visitor": str(uuid4())})).status_code, 429)

    async def test_proxy_global_ceiling_is_still_enforced(self):
        self.settings.proxy_token = SecretStr(SERVICE_TOKEN)
        self.settings.proxy_sessions_per_hour = 20
        for _ in range(20):
            response = await self.client.post("/api/v1/sessions", headers={"X-Orbita-Proxy-Token": SERVICE_TOKEN,
                "X-Orbita-Visitor": str(uuid4())})
            self.assertEqual(response.status_code, 201)
        self.assertEqual((await self.client.post("/api/v1/sessions", headers={"X-Orbita-Proxy-Token": SERVICE_TOKEN,
            "X-Orbita-Visitor": str(uuid4())})).status_code, 429)

    async def test_pending_creation_receipt_from_older_schema_is_replayed(self):
        from mission_api.storage import fingerprint
        key = str(uuid4())
        original = await self.create(key=key)
        old_digest = fingerprint({"scenario_id": "lunar-outpost-v1", "difficulty": "cadet", "seed": 42, "data_mode": "snapshot"})
        with closing(sqlite3.connect(self.settings.database_path)) as c, c:
            c.execute("UPDATE command_receipts SET fingerprint=? WHERE command_key=?", (old_digest, key))
        with patch.object(self.app.state.resources, "capture", side_effect=AssertionError("No debe repetir la captura")):
            replay = await self.create(key=key)
        self.assertEqual(replay.status_code, 201, replay.text)
        self.assertEqual(replay.json(), original.json())


if __name__ == "__main__":
    unittest.main()
