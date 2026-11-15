import { describe, expect, it } from "vitest";
import { MEDALS, QUIZZES, TERMS, newMedals, pickLesson, triggersFor, type Progress } from "@/game/learning";
import { MockMissionClient } from "@/lib/orbita/mock";
import type { MissionView, TimelineEvent } from "@/lib/orbita/schema";

const empty = (): Progress => ({ terms: [], quizzes: {}, medals: [], tutorialDone: false });
const event = (type: string, turn = 0, payload: Record<string, unknown> = {}): TimelineEvent =>
  ({ type, turn, message: "", occurred_at: "2026-11-14T00:00:00Z", payload, source_refs: [], rule_origin: "simulation" });

describe("Contenido educativo", () => {
  it("todas las piezas tienen identificador único y texto en los dos idiomas", () => {
    for (const list of [TERMS, QUIZZES, MEDALS]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    for (const term of TERMS) for (const lang of ["es", "en"] as const) expect(term.term[lang].length * term.text[lang].length).toBeGreaterThan(0);
    for (const quiz of QUIZZES) {
      expect(quiz.options.length).toBe(3);
      expect(quiz.options[quiz.answer]).toBeDefined();
    }
  });
  it("los textos son cortos para lectores de 7 a 12 años", () => {
    for (const term of TERMS) for (const lang of ["es", "en"] as const) expect(term.text[lang].length, term.id).toBeLessThanOrEqual(260);
  });
  it("una palabra se enseña una sola vez y respeta el planeta", () => {
    const start = triggersFor([event("mission_created")], "mars-outpost-v1");
    expect(start).toContain("start@mars");
    const first = pickLesson(start, empty());
    expect(first.term?.id).toBe("kwh");
    const second = pickLesson(start, { ...empty(), terms: ["kwh"] });
    expect(second.term?.id).toBe("sol");
    expect(pickLesson(triggersFor([event("mission_created")], "lunar-outpost-v1"), { ...empty(), terms: ["kwh"] }).term).toBeNull();
  });
  it("una pregunta bien respondida no se repite; una fallada vuelve a salir", () => {
    const triggers = triggersFor([event("earth_reply", 1)], "mars-outpost-v1");
    expect(pickLesson(triggers, empty()).quiz?.id).toBe("why_delay");
    expect(pickLesson(triggers, { ...empty(), quizzes: { why_delay: false } }).quiz?.id).toBe("why_delay");
    expect(pickLesson(triggers, { ...empty(), quizzes: { why_delay: true } }).quiz).toBeNull();
  });
});

describe("Marte en el modo demo", () => {
  async function play(plan: Record<number, string[]>) {
    const api = new MockMissionClient();
    let mission: MissionView = (await api.createMission({ scenario_id: "mars-outpost-v1", seed: 1 })).mission;
    const log: TimelineEvent[] = [];
    const send = async (command: { type: "action" | "advance"; action_id?: string }) => {
      const result = await api.command(mission.state.id, { ...command, expected_version: mission.state.version } as never);
      mission = result.mission;
      log.push(...result.events);
    };
    for (let turn = 0; turn < 12; turn++) {
      for (const action_id of plan[turn] ?? []) await send({ type: "action", action_id });
      await send({ type: "advance" });
    }
    return { api, mission, log };
  }

  it("ofrece llamar a la Tierra y no la reparación de fuga", async () => {
    const mission = (await new MockMissionClient().createMission({ scenario_id: "mars-outpost-v1" })).mission;
    const ids = mission.available_actions.map((a) => a.id);
    expect(ids).toContain("contact_earth");
    expect(ids).not.toContain("repair_water_loop");
    expect(mission.state.rules_version).toBe("mars-1.0.0");
  });
  it("la vista previa no modifica la partida", async () => {
    const api = new MockMissionClient();
    const mission = (await api.createMission({ scenario_id: "mars-outpost-v1" })).mission;
    const preview = await api.preview(mission.state.id, "explore", mission.state.version);
    expect(preview.result.mission.state.science_points).toBe(12);
    expect((await api.mission(mission.state.id)).state.science_points).toBe(0);
  });
  it("un buen plan tiene éxito y gana las medallas de Marte", async () => {
    const { api, mission, log } = await play({
      0: ["explore", "contact_earth"], 2: ["enter_shelter"], 5: ["toggle_greenhouse", "toggle_oxygen_generator"],
      7: ["leave_shelter", "explore"], 10: ["repair_solar_panels", "toggle_oxygen_generator"], 11: ["toggle_greenhouse"],
    });
    const evaluation = await api.evaluation(mission.state.id);
    expect(evaluation.outcome).toBe("success");
    expect(log.map((e) => e.type)).toEqual(expect.arrayContaining(["solar_warning", "solar_incident", "dust_storm", "dust_cleared", "earth_reply"]));
    const ids = newMedals({ mission, log, evaluation, progress: empty() }).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["first_day", "mars_pioneer", "earth_call", "dust_buster", "storm_safe", "scientist"]));
    expect(ids).not.toContain("graduate");
  });
});
