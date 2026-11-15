import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewPanel } from "@/game/LearningCards";
import { EndModal, SourcesModal } from "@/game/GameModals";
import { MockMissionClient } from "@/lib/orbita/mock";
import { Providers } from "@/lib/providers";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); localStorage.clear(); });
const names = { energy_kwh: "Energía", oxygen_kg: "Oxígeno", water_l: "Agua", food_kg: "Comida" };

it("un fallo de previsión bloquea la confirmación y permite recalcular", () => {
  const confirm = vi.fn(), retry = vi.fn();
  render(<Providers><button data-testid="outside">Exterior</button><PreviewPanel label="Generador" hint="Prueba" icon="oxygen" result="error" current={{ resources: {}, science_points: 0, exposure_risk_index: 0 }} names={names} busy={false} onConfirm={confirm} onCancel={() => {}} onRetry={retry} /></Providers>);
  expect(screen.getByRole("alert").textContent).toContain("Reintenta");
  const button = screen.getByRole("button", { name: "¡Hazlo!" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button); expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Recalcular" })); expect(retry).toHaveBeenCalledOnce();
  screen.getByTestId("outside").focus();
  expect(screen.getByTestId("preview").contains(document.activeElement)).toBe(true);
});

it("muestra ambas previsiones y no modifica el estado de la partida", async () => {
  const api = new MockMissionClient();
  const { mission } = await api.createMission({});
  const initial = structuredClone(mission.state);
  const result = await api.preview(initial.id, "toggle_oxygen_generator", initial.version);
  render(<Providers><PreviewPanel label="Generador" hint="Prueba" icon="oxygen" result={result} current={{resources:initial.resources,science_points:initial.science_points,exposure_risk_index:initial.exposure_risk_index}} names={names} busy={false} onConfirm={() => {}} onCancel={() => {}} /></Providers>);
  expect(screen.getByRole("table").textContent).toContain("2.52");
  expect(screen.getByRole("table").textContent).toContain("2.92");
  expect((await api.mission(initial.id)).state).toEqual(initial);
  expect((screen.getByRole("button", {name:"¡Hazlo!"}) as HTMLButtonElement).disabled).toBe(false);
});

it("traduce los objetivos y el comentario semántico al inglés", async () => {
  localStorage.setItem("selene.locale", "en");
  const api = new MockMissionClient();
  const {mission} = await api.createMission({});
  const evaluation = {...await api.evaluation(mission.state.id), final:true, feedback:["Comentario del backend"], feedback_codes:["keep_food"], objectives:{food_reserve:false}};
  render(<Providers><EndModal evaluation={evaluation} onAgain={() => {}} onMenu={() => {}} /></Providers>);
  await waitFor(() => expect(screen.getByText("Keep food for tomorrow")).toBeTruthy());
  expect(screen.getByText(/Switching crops off/)).toBeTruthy();
  expect(screen.queryByText("Comentario del backend")).toBeNull();
});

it("las fuentes en inglés conservan fechas y contexto sin mostrar roles en español", async () => {
  localStorage.setItem("selene.locale", "en");
  const load = vi.fn().mockResolvedValue({id:"test",requested_mode:"snapshot",captured_at:"2026-11-15T00:00:00Z",historical_replay:true,model_derivations:{},notice:"Aviso español",sources:[{id:"radlab-reference",role:"Rol español",interpretation:"Interpretación española",records:[{observed_at:"2024-05-20T00:00:00Z"}],pages_meta:[]}]});
  render(<Providers><SourcesModal open scenarioId="mars-outpost-v1" onClose={() => {}} load={load} /></Providers>);
  await screen.findAllByText("RadLab · Curiosity on Mars");
  expect(screen.queryByText("Rol español")).toBeNull();
  expect(screen.getByText(/2024-05-20T00:00:00Z/)).toBeTruthy();
});
