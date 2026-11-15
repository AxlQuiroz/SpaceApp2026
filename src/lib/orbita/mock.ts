/**
 * BACKEND FALSO para ver la interfaz sin encender Python (`/mision?demo=1`).
 *
 * ⚠️ Sólo para previsualizar el diseño. Imita las reglas del backend, pero la fuente oficial
 * es `API/services/mission-api` (rules.py y engine.py). No usar para la entrega.
 */
import { newIdempotencyKey } from "./client";
import type {
  ActionOption,
  Command,
  CreateMission,
  Evaluation,
  EventList,
  MissionState,
  MissionView,
  MutationResult,
  PreviewResult,
  ScienceBundle,
  TimelineEvent,
} from "./schema";

type ActionId = ActionOption["id"];
type ScenarioId = MissionState["scenario_id"];
type ActionDef = { title: string; costs: Record<string, number> };

const LUNAR_ACTIONS: Partial<Record<ActionId, ActionDef>> = {
  repair_water_loop: { title: "Reparar fuga", costs: { spare_parts: 2, energy_kwh: 2 } },
  repair_solar_panels: { title: "Reparar paneles", costs: { spare_parts: 2, energy_kwh: 3 } },
  enter_shelter: { title: "Entrar al refugio", costs: {} },
  leave_shelter: { title: "Salir del refugio", costs: {} },
  explore: { title: "Explorar", costs: { energy_kwh: 2, oxygen_kg: 0.12, water_l: 0.5, food_kg: 0.1 } },
  activate_oxygen_reserve: { title: "Abrir reserva de oxígeno", costs: {} },
  activate_water_reserve: { title: "Abrir reserva de agua", costs: {} },
  toggle_greenhouse: { title: "Invernadero", costs: {} },
  toggle_oxygen_generator: { title: "Generador de oxígeno", costs: {} },
};
const MARS_ACTIONS: Partial<Record<ActionId, ActionDef>> = {
  repair_solar_panels: { title: "Limpiar paneles", costs: {} },
  enter_shelter: LUNAR_ACTIONS.enter_shelter!,
  leave_shelter: LUNAR_ACTIONS.leave_shelter!,
  explore: LUNAR_ACTIONS.explore!,
  activate_oxygen_reserve: LUNAR_ACTIONS.activate_oxygen_reserve!,
  activate_water_reserve: LUNAR_ACTIONS.activate_water_reserve!,
  toggle_greenhouse: LUNAR_ACTIONS.toggle_greenhouse!,
  toggle_oxygen_generator: LUNAR_ACTIONS.toggle_oxygen_generator!,
  contact_earth: { title: "Informar a la Tierra", costs: { energy_kwh: 1 } },
};

/** Media real de MSL-RAD por bloque de 2 h (uGy/h), 20 de mayo de 2024. Igual que rules.py. */
const MARS_RAD = [3.81, 3.93, 60.05, 246.39, 122.15, 91.23, 72.12, 48.51, 38.63, 31.07, 27.25, 22.93];

const RULES = {
  "lunar-outpost-v1": { version: "lunar-1.2.0" as const, actions: LUNAR_ACTIONS, solarKwh: 11, oxygenKwh: 2.4, generatorWater: 0.45, science: 24 },
  "mars-outpost-v1": { version: "mars-1.2.0" as const, actions: MARS_ACTIONS, solarKwh: 11.008, oxygenKwh: 4, generatorWater: 0, science: 30 },
};
const DUST_TURNS = [6, 7, 8, 9];

const BASE_PARAMS = { turns: 12, actions_per_turn: 2, energy_capacity_kwh: 50, oxygen_capacity_kg: 6, water_capacity_l: 30, food_capacity_kg: 6 };
const SCENARIOS = [
  {
    id: "lunar-outpost-v1",
    title: "AstraNova: primer turno lunar (DEMO)",
    description: "Modo demo sin backend.",
    objectives: ["Completar 12 turnos", "Salud final de al menos 60", "Conseguir 24 puntos científicos"],
    assumptions: ["Modo demo: imita las reglas del backend."],
    parameters: { ...BASE_PARAMS, science_target: 24 },
  },
  {
    id: "mars-outpost-v1",
    title: "AstraNova: jornada en Marte (DEMO)",
    description: "Modo demo sin backend.",
    objectives: ["Completar 12 turnos", "Salud final de al menos 60", "Conseguir 30 puntos científicos"],
    assumptions: ["Modo demo: imita las reglas del backend."],
    parameters: { ...BASE_PARAMS, science_target: 30 },
  },
];

const now = () => new Date().toISOString();
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

function initialState(opts: CreateMission, parent: string | null = null): MissionState {
  const k = opts.difficulty === "commander" ? 0.75 : 1;
  const scenario: ScenarioId = opts.scenario_id ?? "lunar-outpost-v1";
  return {
    id: newIdempotencyKey(),
    scenario_id: scenario,
    rules_version: RULES[scenario].version,
    version: 1,
    status: "active",
    difficulty: opts.difficulty ?? "cadet",
    seed: opts.seed ?? 42,
    turn: 0,
    elapsed_hours: 0,
    duration_hours: 24,
    turn_hours: 2,
    actions_used: 0,
    crew_count: 4,
    crew_health_pct: 100,
    exposure_risk_index: 0,
    science_points: 0,
    unreported_data_points: 0,
    reported_data_points: 0,
    practice_mode: "historical", // El demo visual conserva un solo guion.
    radiation_profile_ugy_h: scenario === "mars-outpost-v1" ? MARS_RAD : [],
    radiation_profile_source_hash: null,
    earth_guidance: null,
    resources: {
      energy_kwh: 32 * k,
      oxygen_kg: 2.8 * k,
      water_l: 18 * k,
      food_kg: 3.2 * k,
      spare_parts: 6,
      reserve_oxygen_kg: 1.2,
      reserve_water_l: 6,
    },
    systems: {
      solar_integrity_pct: 100,
      oxygen_generator_on: true,
      greenhouse_on: true,
      water_leak_active: false,
      crew_in_shelter: false,
      dust_storm_active: false,
      earth_message_pending: false,
      earth_message_data_points: 0,
      earth_reply_due_minutes: null,
    },
    created_at: now(),
    updated_at: now(),
    parent_mission_id: parent,
    end_reason: null,
    science_bundle_id: "demo",
  };
}

function reason(s: MissionState, id: ActionId): string | null {
  const r = s.resources;
  const sy = s.systems;
  const def = RULES[s.scenario_id].actions[id];
  if (!def) return "Esta acción no existe en esta misión.";
  if (s.status !== "active") return "La misión debe estar activa.";
  if (s.actions_used >= 2) return "Ya utilizaste las dos acciones de este turno; avanza el tiempo.";
  if (id === "repair_water_loop" && !sy.water_leak_active) return "No hay una fuga activa.";
  if (id === "repair_solar_panels" && sy.solar_integrity_pct >= 100) return "Los paneles ya están reparados.";
  if ((id === "explore" || id === "repair_solar_panels") && sy.crew_in_shelter) return "La tripulación está en el refugio.";
  if (id === "enter_shelter" && sy.crew_in_shelter) return "La tripulación ya está en el refugio.";
  if (id === "leave_shelter" && !sy.crew_in_shelter) return "La tripulación ya está fuera del refugio.";
  if (id === "activate_oxygen_reserve" && (r.reserve_oxygen_kg <= 0 || r.oxygen_kg >= 6)) return "La reserva está vacía o el depósito de oxígeno está lleno.";
  if (id === "activate_water_reserve" && (r.reserve_water_l <= 0 || r.water_l >= 30)) return "La reserva está vacía o el depósito de agua está lleno.";
  if (id === "contact_earth" && sy.earth_message_pending) return "Ya enviaste un informe; espera la respuesta de la Tierra.";
  for (const [k, v] of Object.entries(def.costs)) {
    if ((r as Record<string, number>)[k] < v) return `Recurso insuficiente: ${k}.`;
  }
  return null;
}

function view(s: MissionState): MissionView {
  const mars = s.scenario_id === "mars-outpost-v1";
  const alerts: string[] = [];
  if (s.systems.water_leak_active) alerts.push("Fuga activa: el agua se pierde cada turno hasta repararla.");
  if (s.systems.solar_integrity_pct < 100)
    alerts.push(mars ? "Paneles con polvo: la producción eléctrica está reducida." : "Paneles dañados: la producción eléctrica está reducida.");
  if (s.systems.dust_storm_active) alerts.push("Tormenta de polvo: llega muy poca luz a los paneles.");
  if (mars && s.turn === 2) alerts.push("El próximo avance trae la radiación de una eyección solar real: considera entrar al refugio.");
  else if (mars && s.turn < 12 && MARS_RAD[s.turn] >= 20) alerts.push("La radiación sigue elevada: permanece en el refugio o entra antes de avanzar.");
  if (mars && s.turn === DUST_TURNS[0] - 1) alerts.push("Se acerca una tormenta de polvo: ahorra batería antes del próximo avance.");
  if (!mars && s.turn === 5) alerts.push("El próximo avance incluye un incidente solar simulado: considera entrar al refugio.");
  if (s.resources.oxygen_kg < 0.8) alerts.push("Reserva principal de oxígeno baja.");
  if (s.resources.water_l < 4) alerts.push("Reserva principal de agua baja.");
  if (s.resources.food_kg < 0.8) alerts.push("Alimentos bajos.");
  if (s.resources.energy_kwh < 8) alerts.push("Batería baja.");
  const actions = RULES[s.scenario_id].actions;
  const available_actions = (Object.keys(actions) as ActionId[]).map((id) => {
    const why = reason(s, id);
    return { id, title: actions[id]!.title, description: "", enabled: why === null, disabled_reason: why, costs: actions[id]!.costs };
  });
  return { state: structuredClone(s), available_actions, alerts,
    planning: { food_autonomy_hours: Math.round(s.resources.food_kg / 0.1 * 100) / 100,
      food_reserve_target_kg: s.difficulty === "commander" ? 0.6 : 0.8,
      pending_reply_minutes: s.systems.earth_reply_due_minutes === null ? null : Math.max(0, s.systems.earth_reply_due_minutes - s.elapsed_hours * 60),
      radio_round_trip_minutes: 40, shelter_recommended: s.turn < 12 && (mars ? MARS_RAD[s.turn] >= 20 : s.turn === 5),
      exposure_target_points: mars ? null : 20 } };
}

function demoRadioReport(s: MissionState): MissionState["earth_guidance"] {
  const next = s.turn < 12 ? MARS_RAD[s.turn] : null;
  const candidates = [s.turn, s.turn + 1].filter(turn => turn < 12 && MARS_RAD[turn] < 20);
  const best = candidates.sort((a, b) => MARS_RAD[a] - MARS_RAD[b])[0] ?? null;
  const dust = s.turn < 9;
  return { received_turn: s.turn, valid_until_turn: Math.min(12, s.turn + 2),
    advice_code: next !== null && next >= 100 ? "shelter_now" : dust && s.turn >= 4 ? "save_power" : s.systems.solar_integrity_pct < 100 ? "clean_panels" : next !== null && next >= 20 ? "shelter_now" : "research_window",
    next_turn_dose_rate_ugy_h: next, suggested_eva_turn: best, dust_start_turn: dust ? 6 : null, dust_end_turn: dust ? 9 : null };
}

const evt = (s: MissionState, type: string, message: string, payload: Record<string, unknown> = {}): TimelineEvent => ({
  type,
  turn: s.turn,
  message,
  occurred_at: now(),
  payload,
  source_refs: [],
  rule_origin: "simulation",
});

/** Aplica una orden sobre `s` (lo modifica) y devuelve los eventos. */
function transition(s: MissionState, command: Command): TimelineEvent[] {
  const rules = RULES[s.scenario_id];
  const mars = s.scenario_id === "mars-outpost-v1";
  const r = s.resources;
  const sy = s.systems;
  const out: TimelineEvent[] = [];
  const before = { ...r };
  const delta = () => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, round(v - (before as Record<string, number>)[k])]));

  if (command.type === "pause") {
    s.status = "paused";
    out.push(evt(s, "mission_paused", "Misión pausada."));
  } else if (command.type === "resume") {
    s.status = "active";
    out.push(evt(s, "mission_resumed", "Misión reanudada."));
  } else if (command.type === "abort") {
    s.status = "aborted";
    s.end_reason = "Misión finalizada por el jugador.";
    out.push(evt(s, "mission_aborted", s.end_reason));
  } else if (command.type === "action" && command.action_id) {
    const id = command.action_id;
    const why = reason(s, id);
    if (why) throw new Error(why);
    for (const [k, v] of Object.entries(rules.actions[id]!.costs)) (r as Record<string, number>)[k] -= v;
    if (id === "repair_water_loop") sy.water_leak_active = false;
    if (id === "repair_solar_panels") sy.solar_integrity_pct = Math.min(100, sy.solar_integrity_pct + 50);
    if (id === "enter_shelter") sy.crew_in_shelter = true;
    if (id === "leave_shelter") sy.crew_in_shelter = false;
    if (id === "explore") {
      s.science_points += 12;
      s.unreported_data_points += 12;
      s.exposure_risk_index = Math.min(100, s.exposure_risk_index + 1);
    }
    if (id === "toggle_greenhouse") sy.greenhouse_on = !sy.greenhouse_on;
    if (id === "toggle_oxygen_generator") sy.oxygen_generator_on = !sy.oxygen_generator_on;
    if (id === "contact_earth") {
      sy.earth_message_pending = true;
      sy.earth_message_data_points = s.unreported_data_points;
      s.unreported_data_points = 0;
      sy.earth_reply_due_minutes = s.elapsed_hours * 60 + 40;
    }
    if (id === "activate_oxygen_reserve") {
      const x = Math.min(0.6, r.reserve_oxygen_kg, 6 - r.oxygen_kg);
      r.reserve_oxygen_kg -= x;
      r.oxygen_kg += x;
    }
    if (id === "activate_water_reserve") {
      const x = Math.min(3, r.reserve_water_l, 30 - r.water_l);
      r.reserve_water_l -= x;
      r.water_l += x;
    }
    s.actions_used += 1;
    out.push(evt(s, "action_applied", rules.actions[id]!.title, { action_id: id, resource_delta: delta() }));
  } else if (command.type === "advance") {
    s.turn += 1;
    s.elapsed_hours = s.turn * 2;
    s.actions_used = 0;
    let storm = false;
    let sky = 1;
    let dose: number | null = null;
    if (mars) {
      dose = MARS_RAD[s.turn - 1];
      if (sy.earth_message_pending) {
        sy.earth_message_pending = false;
        const bonus = sy.earth_message_data_points > 0 ? 6 : 0;
        s.science_points += bonus;
        s.reported_data_points += sy.earth_message_data_points;
        sy.earth_message_data_points = 0;
        sy.earth_reply_due_minutes = null;
        out.push(evt(s, "earth_reply", "La Tierra respondió.", { science_points: bonus }));
      }
      if (s.turn === 2) out.push(evt(s, "solar_warning", "Aviso de clima espacial.", { cme_start_utc: "2024-05-20T05:36Z" }));
      if (s.turn === 3) out.push(evt(s, "solar_incident", "Llegó la radiación.", { sheltered: sy.crew_in_shelter, dose_rate_ugy_h: dose }));
      if (s.turn === DUST_TURNS[0] - 1) out.push(evt(s, "dust_warning", "Se acerca una tormenta de polvo."));
      if (s.turn === DUST_TURNS[0]) {
        sy.dust_storm_active = true;
        out.push(evt(s, "dust_storm", "Tormenta de polvo.", { generation_factor: 0.2 }));
      }
      if (s.turn === DUST_TURNS[DUST_TURNS.length - 1] + 1) {
        sy.dust_storm_active = false;
        sy.solar_integrity_pct = Math.max(0, sy.solar_integrity_pct - 40);
        out.push(evt(s, "dust_cleared", "La tormenta terminó.", { deposit_pct: 40 }));
      }
      sky = sy.dust_storm_active ? 0.2 : 1;
    } else {
      if (s.turn === 2) {
        sy.water_leak_active = true;
        out.push(evt(s, "water_leak", "Fuga de agua."));
      }
      if (s.turn === 5) out.push(evt(s, "solar_warning", "Aviso solar."));
      if (s.turn === 8) {
        sy.solar_integrity_pct = Math.max(0, sy.solar_integrity_pct - 50);
        out.push(evt(s, "panel_damage", "Polvo en paneles."));
      }
      storm = s.turn === 6;
      sky = storm ? 0.3 : 1;
    }
    const gen = rules.solarKwh * (sy.solar_integrity_pct / 100) * sky;
    let avail = r.energy_kwh + gen;
    const fr: Record<string, number> = {};
    for (const [name, need, on] of [
      ["habitat", 4, true],
      ["oxygen", rules.oxygenKwh, sy.oxygen_generator_on],
      ["water", 0.8, true],
      ["greenhouse", 2, sy.greenhouse_on],
    ] as [string, number, boolean][]) {
      const d = on ? need : 0;
      const a = Math.min(avail, d);
      avail -= a;
      fr[name] = d ? a / d : 0;
    }
    r.energy_kwh = clamp(avail, 50);
    r.water_l += 0.6 * fr.water;
    const genFr = rules.generatorWater ? Math.min(fr.oxygen, r.water_l / rules.generatorWater) : fr.oxygen;
    r.water_l -= rules.generatorWater * genFr;
    r.oxygen_kg = clamp(r.oxygen_kg + 0.4 * genFr - 0.28, 6);
    r.food_kg = clamp(r.food_kg + 0.07 * fr.greenhouse - 0.2, 6);
    r.water_l = clamp(r.water_l - 1.2 - (sy.water_leak_active ? 1.6 : 0), 30);
    let risk = mars ? dose! * 0.13 : 0.2;
    if (storm) {
      risk += 28;
      out.push(evt(s, "solar_incident", "Tormenta solar.", { sheltered: sy.crew_in_shelter }));
    }
    if (sy.crew_in_shelter) risk *= 0.1;
    s.exposure_risk_index = round(Math.min(100, s.exposure_risk_index + risk));
    let loss = 35 * (1 - fr.habitat);
    if (r.oxygen_kg <= 0) loss += 40;
    if (r.water_l <= 0) loss += 25;
    if (r.food_kg <= 0) loss += 10;
    loss += Math.max(0, s.exposure_risk_index - 60) / 10;
    s.crew_health_pct = Math.max(0, round(s.crew_health_pct - loss));
    const reply = out.find(e => e.type === "earth_reply");
    if (reply) { s.earth_guidance = demoRadioReport(s); reply.payload.planning_report = s.earth_guidance; }
    out.push(
      evt(s, "turn_advanced", "Turno calculado.", {
        resource_delta: delta(),
        generated_kwh: round(gen),
        curtailed_kwh: 0,
        power_fractions: fr,
        risk_delta_points: round(risk),
        health_loss_points: round(loss),
        ...(dose !== null ? { dose_rate_ugy_h: dose, dose_rate_source: "radlab-reference", sky_factor: sky } : {}),
      }),
    );
    if (s.crew_health_pct <= 0) {
      s.status = "failed";
      out.push(evt(s, "mission_failed", "Salud en cero."));
    } else if (s.turn >= 12) {
      s.status = "completed";
      out.push(evt(s, "mission_completed", "Misión completada."));
    }
  }
  for (const k of Object.keys(r) as (keyof typeof r)[]) r[k] = round(Math.max(0, r[k]));
  s.version += 1;
  s.updated_at = now();
  return out;
}

export class MockMissionClient {
  private records = new Map<string, { state: MissionState; events: TimelineEvent[] }>();

  async createSession() {
    return { session_id: "demo", created_at: now(), expires_at: now() };
  }
  async scenarios() {
    return SCENARIOS as unknown as Array<Record<string, unknown>>;
  }
  async createMission(body: CreateMission = {}): Promise<MutationResult> {
    const state = initialState(body);
    const events = [evt(state, "mission_created", "Misión creada (demo).")];
    this.records.set(state.id, { state, events });
    return { mission: view(state), events };
  }
  async missions(limit = 100, offset = 0) {
    const all = [...this.records.values()].map(({ state }) => ({ ...state }));
    return { data: all.slice(offset, offset + limit), total: all.length, limit, offset };
  }
  async mission(id: string): Promise<MissionView> {
    const m = this.records.get(id);
    if (!m) throw new Error("Misión demo no encontrada");
    return view(m.state);
  }
  async events(id: string): Promise<EventList> {
    const m = this.records.get(id);
    const data = (m?.events ?? []).map((event, i) => ({ sequence: i, mission_version: 0, event }));
    return { data, total: data.length, limit: 100, offset: 0 };
  }
  async restart(id: string): Promise<MutationResult> {
    const old = this.records.get(id)!.state;
    const state = initialState({ scenario_id: old.scenario_id, difficulty: old.difficulty, seed: old.seed }, id);
    const events = [evt(state, "mission_restarted", "Misión reiniciada (demo).")];
    this.records.set(state.id, { state, events });
    return { mission: view(state), events };
  }
  async command(id: string, command: Command): Promise<MutationResult> {
    const m = this.records.get(id)!;
    const out = transition(m.state, command);
    m.events.push(...out);
    return { mission: view(m.state), events: out };
  }
  /** Igual que el backend: calcula el resultado de una acción sin guardarlo. */
  async preview(id: string, actionId: ActionId, expectedVersion: number): Promise<PreviewResult> {
    const copy = structuredClone(this.records.get(id)!.state);
    const events = transition(copy, { type: "action", action_id: actionId, expected_version: expectedVersion });
    const immediate = { mission: view(structuredClone(copy)), events };
    const baseline = structuredClone(this.records.get(id)!.state);
    const baselineEvents = transition(baseline, { type: "advance", expected_version: baseline.version });
    const forecastEvents = transition(copy, { type: "advance", expected_version: copy.version });
    return { persisted: false, based_on_version: expectedVersion, result: immediate,
      forecast: { horizon_hours: 2, without_action: { mission: view(baseline), events: baselineEvents }, with_action: { mission: view(copy), events: forecastEvents } } };
  }

  async evaluation(id: string): Promise<Evaluation> {
    const s = this.records.get(id)!.state;
    const target = RULES[s.scenario_id].science;
    const objectives = {
      completed_duration: s.turn >= 12,
      healthy_crew: s.crew_health_pct >= 60,
      science_target: s.science_points >= target,
      food_reserve: s.resources.food_kg >= (s.difficulty === "commander" ? 0.6 : 0.8),
      ...(s.scenario_id === "mars-outpost-v1" ? { science_shared: s.reported_data_points >= 12 } : { radiation_protection: s.exposure_risk_index <= 20 }),
    };
    const score = Math.round(
      (s.turn / 12) * 30 + (s.crew_health_pct / 100) * 20 + Math.min(1, s.science_points / target) * 20 + (1 - s.exposure_risk_index / 100) * 20 + Math.min(1, s.resources.food_kg / (s.difficulty === "commander" ? 0.6 : 0.8)) * 10,
    );
    const ok = Object.values(objectives).every(Boolean);
    return {
      mission_id: id,
      final: s.status !== "active" && s.status !== "paused",
      outcome: s.status === "aborted" ? "aborted" : s.status === "failed" ? "failed" : s.status === "completed" ? (ok ? "success" : "partial") : "in_progress",
      score: Math.max(0, Math.min(100, score)),
      objectives,
      feedback: ["Modo demo: enciende el backend para la evaluación oficial."],
      rules_version: s.rules_version,
      feedback_codes: [], comparison: null,
    };
  }

  async science(): Promise<ScienceBundle> {
    return {
      id: "demo",
      requested_mode: "snapshot",
      captured_at: now(),
      historical_replay: true,
      model_derivations: {},
      notice: "Modo demo: enciende el backend para ver las fuentes NASA reales.",
      sources: [
        { id: "donki-episode", role: "Contexto histórico de clima espacial", interpretation: "Ejemplo (demo).", records: [], pages_meta: [] },
      ],
    };
  }
}
