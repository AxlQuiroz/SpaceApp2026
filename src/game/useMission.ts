"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MissionApiClient, MissionApiError } from "@/lib/orbita/client";
import { MockMissionClient } from "@/lib/orbita/mock";
import type {
  ActionOption,
  Command,
  CreateMission,
  Evaluation,
  MissionView,
  MutationResult,
  ScienceBundle,
  TimelineEvent,
} from "@/lib/orbita/schema";

/** Parámetros del escenario que usa la interfaz (vienen del backend, no se inventan aquí). */
export type ScenarioParams = {
  turns: number;
  actions_per_turn: number;
  energy_capacity_kwh: number;
  oxygen_capacity_kg: number;
  water_capacity_l: number;
  food_capacity_kg: number;
  science_target: number;
};
export type Scenario = {
  title: string;
  description: string;
  objectives: string[];
  assumptions: string[];
  parameters: ScenarioParams;
};

export type ActionId = ActionOption["id"];
type Phase = "connecting" | "menu" | "playing" | "offline";

const STORAGE_KEY = "selene.missionId";

/** `/mision?demo=1` usa un backend falso en el navegador (sólo para ver la interfaz). */
export function isDemo() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
}

function store(id: string | null) {
  if (isDemo()) return; // la partida demo vive en memoria; no pisa la partida real guardada
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sin almacenamiento: la partida no se reanuda al recargar */
  }
}
function stored(): string | null {
  if (isDemo()) return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useMission() {
  // En modo demo el cliente falso tiene los mismos métodos que usamos del real.
  const api = useRef(
    isDemo()
      ? (new MockMissionClient() as unknown as MissionApiClient)
      : new MissionApiClient(),
  ).current;
  const [phase, setPhase] = useState<Phase>("connecting");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [mission, setMission] = useState<MissionView | null>(null);
  const [log, setLog] = useState<TimelineEvent[]>([]);
  /** eventos de la última orden: el asistente los narra */
  const [latest, setLatest] = useState<TimelineEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  /** orden pendiente tras un fallo de red: se reintenta con la MISMA clave */
  const pending = useRef<{ command: Command; key: string } | null>(null);

  const connect = useCallback(async () => {
    setPhase("connecting");
    setError(null);
    try {
      await api.createSession();
      const sc = (await api.scenarios()).find((s) => s.id === "lunar-outpost-v1") as unknown as Scenario | undefined;
      setScenario(sc ?? null);
      const id = stored();
      if (id) {
        try {
          const m = await api.mission(id);
          const ev = await api.events(id, 100);
          setMission(m);
          setLog(ev.data.map((e) => e.event));
          setPhase("playing");
          if (["completed", "failed", "aborted"].includes(m.state.status)) {
            setEvaluation(await api.evaluation(id));
          }
          return;
        } catch {
          store(null);
        }
      }
      setPhase("menu");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("offline");
    }
  }, [api]);

  useEffect(() => {
    void connect();
  }, [connect]);

  const apply = useCallback(
    async (result: MutationResult) => {
      setMission(result.mission);
      setLatest(result.events);
      setLog((l) => [...l, ...result.events]);
      const st = result.mission.state.status;
      if (st === "completed" || st === "failed" || st === "aborted") {
        setEvaluation(await api.evaluation(result.mission.state.id));
      }
    },
    [api],
  );

  const send = useCallback(
    async (command: Command, key: string = crypto.randomUUID()) => {
      if (!mission) return;
      setBusy(true);
      setError(null);
      pending.current = { command, key };
      try {
        await apply(await api.command(mission.state.id, command, key));
        pending.current = null;
      } catch (e) {
        if (e instanceof MissionApiError && e.code === "VERSION_CONFLICT") {
          // Otra pestaña cambió la partida: recargamos el estado confirmado.
          setMission(await api.mission(mission.state.id));
          pending.current = null;
        } else if (e instanceof MissionApiError && e.code === "NETWORK_ERROR") {
          setError(e.message); // `retry()` reenvía la misma intención
        } else {
          pending.current = null;
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setBusy(false);
      }
    },
    [api, apply, mission],
  );

  const start = useCallback(
    async (opts: CreateMission) => {
      setBusy(true);
      setError(null);
      try {
        const result = await api.createMission({ data_mode: "snapshot", ...opts });
        store(result.mission.state.id);
        setLog([]);
        setEvaluation(null);
        await apply(result);
        setPhase("playing");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [api, apply],
  );

  const restart = useCallback(async () => {
    if (!mission) return;
    setBusy(true);
    try {
      const result = await api.restart(mission.state.id, mission.state.version);
      store(result.mission.state.id);
      setLog([]);
      setEvaluation(null);
      await apply(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [api, apply, mission]);

  const exitToMenu = useCallback(() => {
    store(null);
    setMission(null);
    setLog([]);
    setLatest([]);
    setEvaluation(null);
    setPhase("menu");
  }, []);

  const v = mission?.state.version ?? 0;
  return {
    phase,
    scenario,
    mission,
    log,
    latest,
    busy,
    error,
    evaluation,
    connect,
    start,
    restart,
    exitToMenu,
    clearLatest: () => setLatest([]),
    act: (action_id: ActionId) => send({ type: "action", action_id, expected_version: v }),
    advance: () => send({ type: "advance", expected_version: v }),
    abort: () => send({ type: "abort", expected_version: v }),
    retry: () => pending.current && send(pending.current.command, pending.current.key),
    science: (): Promise<ScienceBundle> | null => (mission ? api.science(mission.state.id) : null),
  };
}

export type MissionController = ReturnType<typeof useMission>;
