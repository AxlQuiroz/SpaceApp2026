/**
 * BACKEND FALSO para ver la interfaz sin encender Python (`/mision?demo=1`).
 *
 * ⚠️ Sólo para previsualizar el diseño. Los números son aproximados y NO son las reglas
 * oficiales (esas viven en el backend, `mission_api/rules.py`). No usar para la entrega.
 */
import type {
  ActionOption,
  Command,
  CreateMission,
  Evaluation,
  EventList,
  MissionState,
  MissionView,
  MutationResult,
  ScienceBundle,
  TimelineEvent,
} from "./schema";

type ActionId = ActionOption["id"];

const ACTIONS: Record<ActionId, { title: string; costs: Record<string, number> }> = {
  repair_water_loop: { title: "Reparar circuito de agua", costs: { spare_parts: 2, energy_kwh: 2 } },
  repair_solar_panels: { title: "Reparar paneles", costs: { spare_parts: 2, energy_kwh: 3 } },
  enter_shelter: { title: "Entrar al refugio", costs: {} },
  leave_shelter: { title: "Salir del refugio", costs: {} },
  explore: { title: "Explorar", costs: { energy_kwh: 2, oxygen_kg: 0.12, water_l: 0.5, food_kg: 0.1 } },
  activate_oxygen_reserve: { title: "Usar reserva de oxígeno", costs: {} },
  activate_water_reserve: { title: "Usar reserva de agua", costs: {} },
  toggle_greenhouse: { title: "Invernadero", costs: {} },
  toggle_oxygen_generator: { title: "Generador de oxígeno", costs: {} },
};

const SCENARIO = {
  id: "lunar-outpost-v1",
  title: "Órbita: primer turno lunar (DEMO)",
  description: "Modo demo sin backend.",
  objectives: ["Completar 12 turnos", "Salud final de al menos 60", "Conseguir 24 puntos científicos"],
  assumptions: ["Modo demo: números aproximados."],
  parameters: {
    turns: 12,
    actions_per_turn: 2,
    energy_capacity_kwh: 50,
    oxygen_capacity_kg: 6,
    water_capacity_l: 30,
    food_capacity_kg: 6,
    science_target: 24,
  },
};

const now = () => new Date().toISOString();
const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

function initialState(opts: CreateMission, parent: string | null = null): MissionState {
  const k = opts.difficulty === "commander" ? 0.75 : 1;
  return {
    id: crypto.randomUUID(),
    scenario_id: "lunar-outpost-v1",
    rules_version: "lunar-1.0.0",
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
  if (s.status !== "active") return "La misión debe estar activa.";
  if (s.actions_used >= 2) return "Ya usaste las acciones de este turno.";
  for (const [k, v] of Object.entries(ACTIONS[id].costs)) {
    if ((r as Record<string, number>)[k] < v) return "No hay recursos suficientes.";
  }
  switch (id) {
    case "repair_water_loop":
      return sy.water_leak_active ? null : "No hay ninguna fuga que reparar.";
    case "repair_solar_panels":
      return sy.solar_integrity_pct < 100 ? (sy.crew_in_shelter ? "Sal del refugio primero." : null) : "Los paneles están bien.";
    case "enter_shelter":
      return sy.crew_in_shelter ? "La tripulación ya está en el refugio." : null;
    case "leave_shelter":
      return sy.crew_in_shelter ? null : "La tripulación no está en el refugio.";
    case "explore":
      return sy.crew_in_shelter ? "No se puede explorar desde el refugio." : null;
    case "activate_oxygen_reserve":
      return r.reserve_oxygen_kg > 0 && r.oxygen_kg < 6 ? null : "No queda reserva o el tanque está lleno.";
    case "activate_water_reserve":
      return r.reserve_water_l > 0 && r.water_l < 30 ? null : "No queda reserva o el tanque está lleno.";
    default:
      return null;
  }
}

function view(s: MissionState): MissionView {
  const alerts: string[] = [];
  if (s.systems.water_leak_active) alerts.push("Fuga activa: el agua se pierde cada turno hasta repararla.");
  if (s.systems.solar_integrity_pct < 100) alerts.push("Paneles dañados: la producción eléctrica está reducida.");
  if (s.turn === 5) alerts.push("El próximo avance incluye un incidente solar simulado: considera entrar al refugio.");
  if (s.resources.oxygen_kg < 0.8) alerts.push("Reserva principal de oxígeno baja.");
  if (s.resources.water_l < 4) alerts.push("Reserva principal de agua baja.");
  if (s.resources.food_kg < 0.8) alerts.push("Alimentos bajos.");
  if (s.resources.energy_kwh < 8) alerts.push("Batería baja.");
  const available_actions = (Object.keys(ACTIONS) as ActionId[]).map((id) => {
    const why = reason(s, id);
    return { id, title: ACTIONS[id].title, description: "", enabled: why === null, disabled_reason: why, costs: ACTIONS[id].costs };
  });
  return { state: structuredClone(s), available_actions, alerts };
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

export class MockMissionClient {
  private records = new Map<string, { state: MissionState; events: TimelineEvent[] }>();

  async createSession() {
    return { session_id: "demo", created_at: now(), expires_at: now() };
  }
  async scenarios() {
    return [SCENARIO as unknown as Record<string, unknown>];
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
    const state = initialState({ difficulty: old.difficulty, seed: old.seed }, id);
    const events = [evt(state, "mission_restarted", "Misión reiniciada (demo).")];
    this.records.set(state.id, { state, events });
    return { mission: view(state), events };
  }

  async command(id: string, command: Command): Promise<MutationResult> {
    const m = this.records.get(id)!;
    const s = m.state;
    const r = s.resources;
    const sy = s.systems;
    const out: TimelineEvent[] = [];
    const before = { ...r };
    const delta = () =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, round(v - (before as Record<string, number>)[k])]));

    if (command.type === "pause") {
      s.status = "paused";
    } else if (command.type === "resume") {
      s.status = "active";
    } else if (command.type === "abort") {
      s.status = "aborted";
      s.end_reason = "Misión finalizada por el jugador.";
      out.push(evt(s, "mission_aborted", s.end_reason));
    } else if (command.type === "action" && command.action_id) {
      const id = command.action_id;
      const why = reason(s, id);
      if (why) throw new Error(why);
      for (const [k, v] of Object.entries(ACTIONS[id].costs)) (r as Record<string, number>)[k] -= v;
      if (id === "repair_water_loop") sy.water_leak_active = false;
      if (id === "repair_solar_panels") sy.solar_integrity_pct = Math.min(100, sy.solar_integrity_pct + 50);
      if (id === "enter_shelter") sy.crew_in_shelter = true;
      if (id === "leave_shelter") sy.crew_in_shelter = false;
      if (id === "explore") {
        s.science_points += 12;
        s.exposure_risk_index += 1;
      }
      if (id === "toggle_greenhouse") sy.greenhouse_on = !sy.greenhouse_on;
      if (id === "toggle_oxygen_generator") sy.oxygen_generator_on = !sy.oxygen_generator_on;
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
      out.push(evt(s, "action_applied", ACTIONS[id].title, { action_id: id, resource_delta: delta() }));
    } else if (command.type === "advance") {
      s.turn += 1;
      s.elapsed_hours += 2;
      s.actions_used = 0;
      if (s.turn === 2) {
        sy.water_leak_active = true;
        out.push(evt(s, "water_leak", "Fuga de agua (demo)."));
      }
      if (s.turn === 5) out.push(evt(s, "solar_warning", "Aviso solar (demo)."));
      if (s.turn === 8) {
        sy.solar_integrity_pct = Math.max(0, sy.solar_integrity_pct - 50);
        out.push(evt(s, "panel_damage", "Polvo en paneles (demo)."));
      }
      const storm = s.turn === 6;
      const gen = 11 * (sy.solar_integrity_pct / 100) * (storm ? 0.3 : 1);
      let avail = r.energy_kwh + gen;
      const fr: Record<string, number> = {};
      for (const [name, need, on] of [
        ["habitat", 4, true],
        ["oxygen", 2.4, sy.oxygen_generator_on],
        ["water", 0.8, true],
        ["greenhouse", 2, sy.greenhouse_on],
      ] as [string, number, boolean][]) {
        const d = on ? need : 0;
        const a = Math.min(avail, d);
        avail -= a;
        fr[name] = d ? a / d : 0;
      }
      r.energy_kwh = clamp(avail, 50);
      r.water_l += 0.6 * fr.water - 0.45 * fr.oxygen;
      r.oxygen_kg += 0.4 * fr.oxygen - 0.28;
      r.food_kg += 0.07 * fr.greenhouse - 0.2;
      r.water_l -= 1.2 + (sy.water_leak_active ? 1.6 : 0);
      r.oxygen_kg = clamp(r.oxygen_kg, 6);
      r.water_l = clamp(r.water_l, 30);
      r.food_kg = clamp(r.food_kg, 6);
      let risk = 0.2 + (storm ? 28 : 0);
      if (sy.crew_in_shelter) risk *= 0.1;
      if (storm) out.push(evt(s, "solar_incident", "Tormenta solar (demo).", { sheltered: sy.crew_in_shelter }));
      s.exposure_risk_index = Math.min(100, s.exposure_risk_index + risk);
      let loss = 35 * (1 - fr.habitat);
      if (r.oxygen_kg <= 0) loss += 40;
      if (r.water_l <= 0) loss += 25;
      if (r.food_kg <= 0) loss += 10;
      loss += Math.max(0, s.exposure_risk_index - 60) / 10;
      s.crew_health_pct = Math.max(0, round(s.crew_health_pct - loss));
      out.push(
        evt(s, "turn_advanced", "Turno calculado (demo).", {
          resource_delta: delta(),
          generated_kwh: round(gen),
          curtailed_kwh: 0,
          power_fractions: fr,
          risk_delta_points: round(risk),
          health_loss_points: round(loss),
        }),
      );
      if (s.crew_health_pct <= 0) {
        s.status = "failed";
        out.push(evt(s, "mission_failed", "Salud en cero (demo)."));
      } else if (s.turn >= 12) {
        s.status = "completed";
        out.push(evt(s, "mission_completed", "Misión completada (demo)."));
      }
    }
    for (const k of Object.keys(r) as (keyof typeof r)[]) r[k] = round(r[k]);
    s.exposure_risk_index = round(s.exposure_risk_index);
    s.version += 1;
    s.updated_at = now();
    m.events.push(...out);
    return { mission: view(s), events: out };
  }

  async evaluation(id: string): Promise<Evaluation> {
    const s = this.records.get(id)!.state;
    const objectives = {
      completed_duration: s.status === "completed",
      healthy_crew: s.crew_health_pct >= 60,
      science_target: s.science_points >= 24,
    };
    const score = Math.round(
      (s.turn / 12) * 40 + (s.crew_health_pct / 100) * 30 + Math.min(1, s.science_points / 24) * 20 + (1 - Math.min(1, s.exposure_risk_index / 60)) * 10,
    );
    const ok = Object.values(objectives).every(Boolean);
    return {
      mission_id: id,
      final: s.status !== "active" && s.status !== "paused",
      outcome: s.status === "aborted" ? "aborted" : s.status === "failed" ? "failed" : ok ? "success" : "partial",
      score,
      objectives,
      feedback: ["Modo demo: la puntuación es aproximada."],
      rules_version: "lunar-1.0.0",
    };
  }

  async science(): Promise<ScienceBundle> {
    return {
      id: "demo",
      requested_mode: "snapshot",
      captured_at: now(),
      historical_replay: true,
      notice: "Modo demo: enciende el backend para ver las fuentes NASA reales.",
      sources: [
        { id: "donki-episode", role: "Contexto histórico de clima espacial", interpretation: "Ejemplo (demo).", records: [], pages_meta: [] },
      ],
    };
  }
}

