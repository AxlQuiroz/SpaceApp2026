import { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMission } from "@/game/useMission";
import { MissionApiClient, MissionApiError } from "@/lib/orbita/client";
import { MockMissionClient } from "@/lib/orbita/mock";
import type { MissionView } from "@/lib/orbita/schema";

const failure = () => new MissionApiError("Temporal", 503, "BACKEND_UNAVAILABLE");
let initial: MissionView;
async function fixture() {
  initial = (await new MockMissionClient().createMission({ seed: 42 })).mission;
  return {
    createSession: vi.fn().mockResolvedValue({ session_id: "player" }),
    scenarios: vi.fn().mockResolvedValue([{ id: "lunar-outpost-v1", parameters: { turns: 12 } }]),
    missions: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    mission: vi.fn().mockImplementation(async () => structuredClone(initial)),
    events: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    evaluation: vi.fn().mockResolvedValue({ final: true, outcome: "success", score: 99 }),
    createMission: vi.fn().mockImplementation(async () => ({ mission: structuredClone(initial), events: [] })),
    command: vi.fn().mockImplementation(async () => ({ mission: { ...structuredClone(initial), state: { ...initial.state, version: 2, turn: 1 } }, events: [] })),
    restart: vi.fn().mockImplementation(async () => ({ mission: { ...structuredClone(initial), state: { ...initial.state, id: "restarted" } }, events: [] })),
    science: vi.fn(),
  };
}
type Api = Awaited<ReturnType<typeof fixture>>;
const mount = (api: Api) => renderHook(() => useMission(api as unknown as MissionApiClient));
async function started(api: Api) {
  const hook = mount(api);
  await waitFor(() => expect(hook.result.current.phase).toBe("menu"));
  await act(() => hook.result.current.start({ seed: 42 }));
  return hook;
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Recuperación de partidas y órdenes", () => {
  it("conserva la partida ante un 503 y permite reanudar después", async () => {
    const api = await fixture(); localStorage.setItem("selene.missionId", initial.state.id);
    api.mission.mockRejectedValueOnce(failure());
    const hook = mount(api);
    await waitFor(() => expect(hook.result.current.phase).toBe("offline"));
    expect(localStorage.getItem("selene.missionId")).toBe(initial.state.id);
    expect(hook.result.current.error).toBe("Temporal");
    await act(() => hook.result.current.connect());
    expect(hook.result.current.phase).toBe("playing");
  });
  it("descarta una referencia sólo cuando el servidor confirma 404", async () => {
    const api = await fixture(); localStorage.setItem("selene.missionId", initial.state.id);
    api.mission.mockRejectedValueOnce(new MissionApiError("No existe", 404, "MISSION_NOT_FOUND"));
    const hook = mount(api);
    await waitFor(() => expect(hook.result.current.phase).toBe("menu"));
    expect(localStorage.getItem("selene.missionId")).toBeNull();
  });
  it("reintenta un comando 503 con UUID y cuerpo idénticos", async () => {
    const api = await fixture(); const hook = await started(api);
    api.command.mockRejectedValueOnce(failure());
    await act(() => hook.result.current.advance());
    expect(hook.result.current.hasPending).toBe(true);
    expect(hook.result.current.canRetry).toBe(true);
    await act(() => hook.result.current.act("explore"));
    expect(api.command).toHaveBeenCalledTimes(1);
    await act(() => hook.result.current.retry());
    expect(api.command.mock.calls[1]).toEqual(api.command.mock.calls[0]);
    expect(hook.result.current.hasPending).toBe(false);
    expect(hook.result.current.mission?.state.turn).toBe(1);
  });
  it("no duplica la creación al reintentar una respuesta perdida", async () => {
    const api = await fixture(); api.createMission.mockRejectedValueOnce(failure());
    const hook = mount(api); await waitFor(() => expect(hook.result.current.phase).toBe("menu"));
    await act(() => hook.result.current.start({ seed: 7 }));
    await act(() => hook.result.current.retry());
    expect(api.createMission.mock.calls[1]).toEqual(api.createMission.mock.calls[0]);
    expect(hook.result.current.phase).toBe("playing");
  });
  it("conserva el UUID y versión al reintentar un reinicio", async () => {
    const api = await fixture(); const hook = await started(api);
    api.restart.mockRejectedValueOnce(failure());
    await act(() => hook.result.current.restart());
    await act(() => hook.result.current.retry());
    expect(api.restart.mock.calls[1]).toEqual(api.restart.mock.calls[0]);
  });
  it("bloquea dos pulsaciones antes del siguiente render", async () => {
    const api = await fixture(); const hook = await started(api);
    await act(async () => { await Promise.all([hook.result.current.advance(), hook.result.current.advance()]); });
    expect(api.command).toHaveBeenCalledTimes(1);
  });
  it("reintenta sólo lecturas si falla la evaluación de una orden confirmada", async () => {
    const api = await fixture(); const hook = await started(api);
    const completed = { ...structuredClone(initial), state: { ...initial.state, status: "completed" as const, version: 2 } };
    api.command.mockResolvedValueOnce({ mission: completed, events: [] });
    api.mission.mockResolvedValue(completed);
    api.evaluation.mockRejectedValueOnce(failure());
    await act(() => hook.result.current.advance());
    expect(hook.result.current.hasPending).toBe(false);
    await act(() => hook.result.current.retry());
    expect(api.command).toHaveBeenCalledTimes(1);
    expect(api.evaluation).toHaveBeenCalledTimes(2);
    expect(hook.result.current.evaluation?.score).toBe(99);
  });
  it("tras un conflicto y un fallo de lectura no reenvía el comando viejo", async () => {
    const api = await fixture(); const hook = await started(api);
    api.command.mockRejectedValueOnce(new MissionApiError("Cambió", 409, "VERSION_CONFLICT"));
    api.mission.mockRejectedValueOnce(failure());
    await act(() => hook.result.current.advance());
    await act(() => hook.result.current.retry());
    expect(api.command).toHaveBeenCalledTimes(1);
    expect(api.mission).toHaveBeenCalledTimes(2);
  });
  it("volver al menú conserva la partida y permite abrirla", async () => {
    const api = await fixture(); const hook = await started(api);
    await act(async () => hook.result.current.exitToMenu());
    expect(localStorage.getItem("selene.missionId")).toBe(initial.state.id);
    expect(hook.result.current.phase).toBe("menu");
    await act(() => hook.result.current.openMission(initial.state.id));
    expect(hook.result.current.phase).toBe("playing");
  });
  it("recupera una orden pendiente tras recargar la misma sesión", async () => {
    const api = await fixture(); const hook = await started(api);
    api.command.mockRejectedValueOnce(failure());
    await act(() => hook.result.current.advance());
    const original = api.command.mock.calls[0]; hook.unmount();
    const resumed = mount(api);
    await waitFor(() => expect(resumed.result.current.phase).toBe("playing"));
    expect(api.command.mock.calls[1]).toEqual(original);
    expect(sessionStorage.getItem("selene.pending.v1")).toBeNull();
  });
  it("no aplica órdenes pendientes a una sesión distinta", async () => {
    const api = await fixture();
    sessionStorage.setItem("selene.pending.v1", JSON.stringify({ sessionId: "expired", operation: { kind: "create", key: crypto.randomUUID(), body: {} } }));
    const hook = mount(api); await waitFor(() => expect(hook.result.current.phase).toBe("menu"));
    expect(api.createMission).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("selene.pending.v1")).toBeNull();
  });
  it("StrictMode no crea dos sesiones simultáneas", async () => {
    const api = await fixture();
    const hook = renderHook(() => useMission(api as unknown as MissionApiClient), { wrapper: StrictMode });
    await waitFor(() => expect(hook.result.current.phase).toBe("menu"));
    expect(api.createSession).toHaveBeenCalledTimes(1);
  });
  it("respeta Retry-After antes de repetir una orden limitada", async () => {
    const api = await fixture(); const hook = await started(api);
    vi.useFakeTimers();
    api.command.mockRejectedValueOnce(new MissionApiError("Espera", 429, "RATE_LIMITED", undefined, undefined, 1));
    await act(() => hook.result.current.advance());
    expect(hook.result.current.retryIn).toBe(1);
    await act(() => hook.result.current.retry());
    expect(api.command).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(() => hook.result.current.retry());
    expect(api.command).toHaveBeenCalledTimes(2);
  });
});
