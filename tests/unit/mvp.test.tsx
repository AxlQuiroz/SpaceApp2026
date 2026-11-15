import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { dictionaries } from "@/i18n/dictionaries";
import { costText, suggestAction } from "@/game/actionGuide";
import { MEDALS, type Progress } from "@/game/learning";
import { RadioReport } from "@/game/RadioReport";
import { FamilyModal } from "@/components/menu/FamilyModal";
import { Providers } from "@/lib/providers";
import { MockMissionClient } from "@/lib/orbita/mock";
import type { TimelineEvent } from "@/lib/orbita/schema";

const progress: Progress = { terms: [], quizzes: {}, medals: [], tutorialDone: true };
const event = (type: string, turn: number, payload = {}): TimelineEvent => ({ type, turn, payload, message: "", occurred_at: "2026-11-15T00:00:00Z", source_refs: [], rule_origin: "simulation" });
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); localStorage.clear(); });

it("recomienda refugio en pleno pico y respeta la previsión del backend al terminar", async () => {
  const m = (await new MockMissionClient().createMission({ scenario_id: "mars-outpost-v1" })).mission;
  m.state.turn = 4;
  m.planning!.shelter_recommended = true;
  expect(suggestAction(dictionaries.es, m, "storm")?.id).toBe("enter_shelter");
  m.planning!.shelter_recommended = false;
  expect(suggestAction(dictionaries.es, m, "storm")?.id).not.toBe("enter_shelter");
  m.state.systems.crew_in_shelter = true;
  m.available_actions.find(a => a.id === "leave_shelter")!.enabled = true;
  expect(suggestAction(dictionaries.es, m, "storm")?.id).toBe("leave_shelter");
  expect(costText(dictionaries.es, {})).toContain("1 acción");
});

it("la medalla usa el turno observado de la fuga y rechaza una reparación tardía", async () => {
  const mission = (await new MockMissionClient().createMission({})).mission;
  const medal = MEDALS.find(m => m.id === "plumber")!;
  for (const turn of [2, 3]) {
    expect(medal.earned({ mission, evaluation: null, progress, log: [event("water_leak", turn), event("action_applied", turn, { action_id: "repair_water_loop" })] })).toBe(true);
    expect(medal.earned({ mission, evaluation: null, progress, log: [event("water_leak", turn), event("action_applied", turn + 1, { action_id: "repair_water_loop" })] })).toBe(false);
  }
});

it("un informe conserva sus datos y deja de aconsejar cuando está vencido", () => {
  const report = { received_turn: 3, valid_until_turn: 5, advice_code: "shelter_now" as const, next_turn_dose_rate_ugy_h: 246.39, suggested_eva_turn: null, dust_start_turn: 6, dust_end_turn: 9 };
  const { rerender } = render(<Providers><RadioReport report={report} turn={3} /></Providers>);
  expect(screen.getByText(/246.39/)).toBeTruthy();
  expect(screen.getByText(/No hay una ventana/)).toBeTruthy();
  rerender(<Providers><RadioReport report={report} turn={5} /></Providers>);
  expect(screen.getByText(/Informe anterior/)).toBeTruthy();
  expect(screen.queryByText(/246.39/)).toBeNull();
});

it("la medalla de protección espera la meta aunque todavía no llegue la evaluación", async () => {
  const mission = (await new MockMissionClient().createMission({})).mission;
  mission.state.status = "completed";
  mission.state.exposure_risk_index = 33;
  const medal = MEDALS.find(m => m.id === "storm_safe")!;
  expect(medal.earned({ mission, evaluation: null, progress, log: [] })).toBe(false);
  mission.state.exposure_risk_index = 7;
  expect(medal.earned({ mission, evaluation: null, progress, log: [] })).toBe(true);
});

it("las pestañas para familias se recorren con flechas, Home y End", () => {
  render(<Providers><FamilyModal open onClose={() => {}} progress={progress} /></Providers>);
  const tabs = screen.getAllByRole("tab");
  fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
  expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(tabs[1]);
  fireEvent.keyDown(tabs[1], { key: "End" });
  expect(tabs[3].getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(tabs[3], { key: "Home" });
  expect(tabs[0].getAttribute("aria-selected")).toBe("true");
});
