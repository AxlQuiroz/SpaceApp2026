"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MissionApiClient, MissionApiError } from "@/lib/orbita/client";
import { MockMissionClient } from "@/lib/orbita/mock";
import type { ActionOption, Command, CreateMission, Evaluation, MissionSummary, MissionView, MutationResult, ScienceBundle, TimelineEvent } from "@/lib/orbita/schema";

export type ScenarioParams = {
  turns: number; actions_per_turn: number; energy_capacity_kwh: number;
  oxygen_capacity_kg: number; water_capacity_l: number; food_capacity_kg: number; science_target: number;
};
export type Scenario = { title: string; description: string; objectives: string[]; assumptions: string[]; parameters: ScenarioParams };
export type ActionId = ActionOption["id"];
type Phase = "connecting" | "menu" | "playing" | "offline";
type Pending =
  | { kind: "create"; key: string; body: CreateMission }
  | { kind: "command"; key: string; id: string; body: Command }
  | { kind: "restart"; key: string; id: string; version: number };
type SavedPending = { sessionId: string; operation: Pending };
const STORAGE_KEY = "selene.missionId";
const PENDING_KEY = "selene.pending.v1";
const terminal = (m: MissionView) => ["completed", "failed", "aborted"].includes(m.state.status);
const transient = (e: unknown) => e instanceof MissionApiError && (e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500);

/** El modo demo nunca modifica la partida ni la orden pendiente del juego real. */
export function isDemo() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
}
function store(id: string | null) {
  if (isDemo()) return;
  try { if (id) localStorage.setItem(STORAGE_KEY, id); else localStorage.removeItem(STORAGE_KEY); } catch {}
}
function stored(): string | null {
  if (isDemo()) return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function readPending(): SavedPending | null {
  if (isDemo()) return null;
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as SavedPending | null;
    if (!p || typeof p.sessionId !== "string" || typeof p.operation?.key !== "string") return null;
    const op = p.operation;
    if (op.kind === "create" && op.body && typeof op.body === "object") return p;
    if (op.kind === "command" && typeof op.id === "string" && op.body && Number.isInteger(op.body.expected_version)) return p;
    if (op.kind === "restart" && typeof op.id === "string" && Number.isInteger(op.version)) return p;
  } catch {}
  return null;
}

/** El cliente inyectable permite probar el controlador sin replicar sus reglas. */
export function useMission(client?: MissionApiClient) {
  const [api] = useState(() => client ?? (isDemo() ? new MockMissionClient() as unknown as MissionApiClient : new MissionApiClient()));
  const [phase, setPhase] = useState<Phase>("connecting");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [mission, setMission] = useState<MissionView | null>(null);
  const [savedMissions, setSavedMissions] = useState<MissionSummary[]>([]);
  const [log, setLog] = useState<TimelineEvent[]>([]);
  const [latest, setLatest] = useState<TimelineEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const retryAt = useRef(0);
  const pending = useRef<Pending | null>(null);
  const sessionId = useRef("");
  const lock = useRef(false);
  const retryTask = useRef<(() => Promise<void>) | null>(null);

  const setPending = useCallback((operation: Pending | null) => {
    pending.current = operation;
    setHasPending(!!operation);
    if (isDemo()) return;
    try {
      if (operation) sessionStorage.setItem(PENDING_KEY, JSON.stringify({ sessionId: sessionId.current, operation }));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {}
  }, []);

  const remember = useCallback((m: MissionView) => {
    store(m.state.id);
    setMission(m);
    setSavedMissions(previous => [{ ...m.state }, ...previous.filter(x => x.id !== m.state.id)]);
  }, []);

  const run = useCallback(async (task: () => Promise<void>, failurePhase?: Phase) => {
    // Un ref bloquea también dos clics recibidos antes del siguiente render de React.
    if (lock.current || Date.now() < retryAt.current) return;
    lock.current = true;
    setBusy(true); setError(null); setCanRetry(false);
    retryTask.current = task;
    try {
      await task();
      retryTask.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCanRetry(transient(e));
      const delay = e instanceof MissionApiError ? e.retryAfter ?? 0 : 0;
      retryAt.current = Date.now() + delay * 1000;
      setRetryIn(delay);
      if (!transient(e)) retryTask.current = null;
      if (failurePhase || (e instanceof MissionApiError && e.status === 401)) setPhase(failurePhase ?? "offline");
    } finally {
      lock.current = false; setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!retryIn) return;
    const timer = window.setTimeout(() => setRetryIn(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000))), 1000);
    return () => window.clearTimeout(timer);
  }, [retryIn]);

  const loadMission = useCallback(async (id: string) => {
    const m = await api.mission(id);
    const events: TimelineEvent[] = [];
    let offset = 0;
    while (true) {
      const page = await api.events(id, 100, offset);
      events.push(...page.data.map(e => e.event));
      offset += page.data.length;
      if (offset >= page.total) break;
      if (!page.data.length) throw new MissionApiError("No se pudo recuperar el historial completo.", 502, "INVALID_RESPONSE");
    }
    const result = terminal(m) ? await api.evaluation(id) : null;
    remember(m); setLog(events); setLatest([]); setEvaluation(result); setPhase("playing");
  }, [api, remember]);

  const apply = useCallback(async (result: MutationResult, fresh: boolean) => {
    remember(result.mission);
    setLatest(result.events);
    setLog(previous => {
      const unique = new Map((fresh ? [] : previous).map(e => [JSON.stringify(e), e]));
      result.events.forEach(e => unique.set(JSON.stringify(e), e));
      return [...unique.values()];
    });
    setEvaluation(null); setPhase("playing");
    // La mutación ya está confirmada. Si falla la evaluación se reintenta una lectura.
    retryTask.current = () => loadMission(result.mission.state.id);
    if (terminal(result.mission)) setEvaluation(await api.evaluation(result.mission.state.id));
  }, [api, loadMission, remember]);

  const execute = useCallback(async (operation: Pending) => {
    setPending(operation);
    let result: MutationResult;
    try {
      if (operation.kind === "create") result = await api.createMission(operation.body, operation.key);
      else if (operation.kind === "restart") result = await api.restart(operation.id, operation.version, operation.key);
      else result = await api.command(operation.id, operation.body, operation.key);
    } catch (e) {
      if (!transient(e)) setPending(null);
      if (e instanceof MissionApiError && e.code === "VERSION_CONFLICT" && operation.kind !== "create") {
        retryTask.current = () => loadMission(operation.id);
        await loadMission(operation.id);
        return;
      }
      throw e;
    }
    setPending(null);
    await apply(result, operation.kind !== "command");
  }, [api, apply, loadMission, setPending]);

  const connect = useCallback(() => run(async () => {
    setPhase("connecting");
    const session = await api.createSession();
    sessionId.current = session.session_id;
    const saved = readPending();
    setPending(saved?.sessionId === session.session_id ? saved.operation : null);
    const sc = (await api.scenarios()).find(s => s.id === "lunar-outpost-v1");
    if (!sc?.parameters) throw new MissionApiError("El escenario no está disponible.", 503, "SCENARIO_UNAVAILABLE");
    setScenario(sc as unknown as Scenario);
    if (pending.current) {
      const operation = pending.current;
      retryTask.current = () => execute(operation);
      await execute(operation);
      const confirmedId = stored();
      if (confirmedId) await loadMission(confirmedId);
      return;
    }
    const id = stored();
    if (id) {
      try { await loadMission(id); return; }
      catch (e) {
        // Sólo un 404 confirma que esta sesión ya no tiene acceso a esa partida.
        if (!(e instanceof MissionApiError && e.status === 404)) throw e;
        store(null); setMission(null); setEvaluation(null); setLatest([]); setLog([]);
      }
    }
    setSavedMissions((await api.missions(100)).data);
    setPhase("menu");
  }, "offline"), [api, execute, loadMission, run, setPending]);

  useEffect(() => { void connect(); }, [connect]);

  const mutate = useCallback((operation: Pending) => {
    if (pending.current) return Promise.resolve();
    return run(() => execute(operation));
  }, [execute, run]);
  const start = useCallback((opts: CreateMission) => mutate({ kind: "create", key: crypto.randomUUID(), body: { data_mode: "snapshot", ...opts } }), [mutate]);
  const send = useCallback((command: Command) => mission ? mutate({ kind: "command", key: crypto.randomUUID(), id: mission.state.id, body: command }) : Promise.resolve(), [mission, mutate]);
  const restart = useCallback(() => mission ? mutate({ kind: "restart", key: crypto.randomUUID(), id: mission.state.id, version: mission.state.version }) : Promise.resolve(), [mission, mutate]);
  const exitToMenu = useCallback(() => {
    if (lock.current || pending.current) return;
    setLatest([]); setError(null); setCanRetry(false); setPhase("menu");
    void run(async () => setSavedMissions((await api.missions(100)).data));
  }, [api, run]);
  const openMission = useCallback((id: string) => {
    if (pending.current) return Promise.resolve();
    return run(() => loadMission(id), "offline");
  }, [loadMission, run]);
  const retry = useCallback(() => {
    const task = retryTask.current;
    return task ? run(task, phase === "offline" ? "offline" : undefined) : Promise.resolve();
  }, [phase, run]);
  const version = mission?.state.version ?? 0;
  const missionId = mission?.state.id;
  const science = useCallback((): Promise<ScienceBundle> | null => missionId ? api.science(missionId) : null, [api, missionId]);
  return {
    phase, scenario, mission, savedMissions, log, latest, busy, error, evaluation, hasPending, canRetry, retryIn,
    connect, start, restart, exitToMenu, openMission, retry,
    clearLatest: () => setLatest([]),
    act: (action_id: ActionId) => send({ type: "action", action_id, expected_version: version }),
    advance: () => send({ type: "advance", expected_version: version }),
    abort: () => send({ type: "abort", expected_version: version }),
    pause: () => send({ type: "pause", expected_version: version }),
    resume: () => send({ type: "resume", expected_version: version }),
    science,
  };
}
export type MissionController = ReturnType<typeof useMission>;
