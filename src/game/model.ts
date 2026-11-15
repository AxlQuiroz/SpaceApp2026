/**
 * Traduce el estado del backend (MissionView) a lo que dibuja el HUD.
 * Aquí NO hay reglas de simulación: sólo presentación del estado confirmado.
 */
import type { MissionView, TimelineEvent } from "@/lib/orbita/schema";
import type { IconName, SpriteName } from "@/sprites/sprites.config";
import type { SpaceWeatherLevel } from "@/components/hud";
import type { Dict } from "@/i18n/dictionaries";
import type { ActionId } from "./useMission";

export type ModuleId = "habitat" | "oxygen" | "water" | "greenhouse" | "shelter" | "solar";
export type ModuleStatus = "ok" | "off" | "damaged" | "leak" | "occupied";

export type BaseModule = {
  id: ModuleId;
  icon: IconName;
  sprite?: { name: SpriteName; anim: string };
  status: ModuleStatus;
  /** posición en el minimapa (unidades del minimapa 64x40) */
  map: { x: number; y: number; w: number; h: number };
};

export const isMars = (m: MissionView | { state: { scenario_id: string } }) => m.state.scenario_id === "mars-outpost-v1";

/** Orden fijo de la tarjeta de comandos: Q W E / A S D / Z X C. */
const LUNAR_LAYOUT: { id: ActionId; icon: IconName }[] = [
  { id: "explore", icon: "explore" },
  { id: "repair_water_loop", icon: "repairWater" },
  { id: "repair_solar_panels", icon: "repairSolar" },
  { id: "toggle_oxygen_generator", icon: "oxygen" },
  { id: "toggle_greenhouse", icon: "farm" },
  { id: "activate_oxygen_reserve", icon: "tank" },
  { id: "activate_water_reserve", icon: "food" },
  { id: "enter_shelter", icon: "shelter" },
  { id: "leave_shelter", icon: "exit" },
];
/** En Marte no hay fuga de agua: su lugar lo ocupa la llamada a la Tierra. */
const MARS_LAYOUT = LUNAR_LAYOUT.map((c) => (c.id === "repair_water_loop" ? { id: "contact_earth" as ActionId, icon: "antenna" as IconName } : c));
export const commandLayout = (m: MissionView) => (isMars(m) ? MARS_LAYOUT : LUNAR_LAYOUT);

/** Textos que cambian según el planeta (la Luna es la base; Marte sobrescribe algunos). */
export function actionText(t: Dict, m: MissionView, id: ActionId) {
  const mars = t.mars.actions as Partial<Record<ActionId, { label: string; hint: string }>>;
  return (isMars(m) && mars[id]) || t.actions[id];
}
export function moduleText(t: Dict, m: MissionView, id: ModuleId) {
  const mars = t.mars.modules as Partial<Record<ModuleId, { name: string; desc: string }>>;
  return (isMars(m) && mars[id]) || t.modules[id];
}
/** Narración de R0-B1 para un evento, o null si ese evento no se narra. */
export function eventText(t: Dict, m: MissionView, type: string): string | null {
  const mars = t.mars.events as Record<string, string>;
  if (isMars(m) && mars[type]) return mars[type];
  return (t.events as Record<string, string>)[type] ?? null;
}

/** Umbrales de alerta: los mismos que usa el backend para sus `alerts`. */
export const DANGER = { energy_kwh: 8, oxygen_kg: 0.8, water_l: 4, food_kg: 0.8 } as const;

/** Colores del traje de cada tripulante (franja del pecho, clave "O" del sprite). */
export const CREW = [
  { id: "c1", swap: {} },
  { id: "c2", swap: { O: "C" } },
  { id: "c3", swap: { O: "L" } },
  { id: "c4", swap: { O: "Y" } },
] as const;

export function deriveModules(m: MissionView): BaseModule[] {
  const sy = m.state.systems;
  return [
    { id: "solar", icon: "solar", status: sy.solar_integrity_pct < 100 ? "damaged" : "ok", map: { x: 2, y: 1, w: 60, h: 4 } },
    { id: "habitat", icon: "rest", status: "ok", map: { x: 2, y: 10, w: 19, h: 12 } },
    {
      id: "oxygen",
      icon: "oxygen",
      sprite: { name: isMars(m) ? "moxie" : "oxygenGen", anim: sy.oxygen_generator_on ? "on" : "off" },
      status: sy.oxygen_generator_on ? "ok" : "off",
      map: { x: 23, y: 10, w: 18, h: 12 },
    },
    {
      id: "water",
      icon: "food",
      sprite: { name: "waterTank", anim: sy.water_leak_active ? "leak" : "normal" },
      status: sy.water_leak_active ? "leak" : "ok",
      map: { x: 43, y: 10, w: 19, h: 12 },
    },
    {
      id: "greenhouse",
      icon: "farm",
      sprite: { name: "greenhouse", anim: sy.greenhouse_on ? "normal" : "unpowered" },
      status: sy.greenhouse_on ? "ok" : "off",
      map: { x: 2, y: 25, w: 29, h: 12 },
    },
    { id: "shelter", icon: "shelter", status: sy.crew_in_shelter ? "occupied" : "ok", map: { x: 33, y: 25, w: 29, h: 12 } },
  ];
}

export const isAlarm = (s: ModuleStatus) => s === "damaged" || s === "leak";

/** Tasa de dosis (uGy/h) a partir de la cual el HUD muestra "activo" o "tormenta" en Marte. */
const MARS_ACTIVE_UGY_H = 20;
const MARS_STORM_UGY_H = 100;

/** Clima espacial del turno actual, a partir de los eventos ya ocurridos. */
export function spaceWeather(m: MissionView, log: TimelineEvent[]): SpaceWeatherLevel {
  const turn = m.state.turn;
  if (isMars(m)) {
    // En Marte el nivel sigue la medición real del turno (la envía el backend en turn_advanced).
    const last = log.findLast((e) => e.type === "turn_advanced" && e.turn === turn);
    const dose = typeof last?.payload.dose_rate_ugy_h === "number" ? last.payload.dose_rate_ugy_h : 0;
    if (dose >= MARS_STORM_UGY_H) return "storm";
    if (dose >= MARS_ACTIVE_UGY_H || log.some((e) => e.type === "solar_warning" && e.turn === turn)) return "active";
    return "calm";
  }
  if (log.some((e) => e.type === "solar_incident" && e.turn === turn)) return "storm";
  if (log.some((e) => e.type === "solar_warning" && e.turn === turn)) return "active";
  return "calm";
}

/** Dónde está cada tripulante (índice de CREW → módulo). */
export function crewPlacement(m: MissionView): ModuleId[] {
  if (m.state.systems.crew_in_shelter) return ["shelter", "shelter", "shelter", "shelter"];
  return ["habitat", "oxygen", "greenhouse", "water"];
}

/* ------------------------------------------------------------------ */
/* Actividad visual tras una acción (sólo presentación, ~4 s)          */
/* ------------------------------------------------------------------ */

export type Activity = {
  key: number;
  /** astronauta caminando con bandera por la superficie */
  explorer?: boolean;
  /** astronauta trabajando junto a los paneles */
  surfaceWorker?: boolean;
  /** módulo donde alguien trabaja (anim "work") */
  workRoom?: ModuleId;
  /** módulo que parpadea al encender/apagar o recibir la reserva */
  flicker?: ModuleId;
  /** ondas de radio saliendo de la antena (llamada a la Tierra) */
  radio?: boolean;
};

export function activityFor(action: ActionId, key: number): Activity {
  switch (action) {
    case "explore":
      return { key, explorer: true };
    case "repair_solar_panels":
      return { key, surfaceWorker: true };
    case "repair_water_loop":
      return { key, workRoom: "water" };
    case "toggle_oxygen_generator":
    case "activate_oxygen_reserve":
      return { key, flicker: "oxygen" };
    case "toggle_greenhouse":
      return { key, flicker: "greenhouse" };
    case "activate_water_reserve":
      return { key, flicker: "water" };
    case "enter_shelter":
    case "leave_shelter":
      return { key, flicker: "shelter" };
    case "contact_earth":
      return { key, radio: true, workRoom: "habitat" };
  }
}

/** Datos del evento `turn_advanced` (los calcula el backend). */
export type TurnPayload = {
  resource_delta: Record<string, number>;
  generated_kwh: number;
  curtailed_kwh: number;
  power_fractions: Record<"habitat" | "oxygen" | "water" | "greenhouse", number>;
  risk_delta_points: number;
  health_loss_points: number;
  /** Sólo Marte: medición real de MSL-RAD para estas dos horas y fracción de luz que pasó. */
  dose_rate_ugy_h?: number;
  sky_factor?: number;
  power_protection_factor?: number;
  observation_start_utc?: string;
  observation_end_utc?: string;
};

/** Traducciones de las alertas del backend (que llegan en español). */
const ALERTS_EN: Record<string, string> = {
  "Fuga activa: el agua se pierde cada turno hasta repararla.": "Active leak: water is lost every turn until it's fixed.",
  "Paneles dañados: la producción eléctrica está reducida.": "Damaged panels: power production is reduced.",
  "Paneles con polvo: la producción eléctrica está reducida.": "Dusty panels: power production is reduced.",
  "Tormenta de polvo: llega muy poca luz a los paneles.": "Dust storm: very little light reaches the panels.",
  "El próximo avance incluye un incidente solar simulado: considera entrar al refugio.":
    "The next advance brings a simulated solar event: consider going to the shelter.",
  "El próximo avance trae la radiación de una eyección solar real: considera entrar al refugio.":
    "The next advance brings radiation from a real solar eruption: consider going to the shelter.",
  "La radiación sigue elevada: permanece en el refugio o entra antes de avanzar.":
    "Radiation is still elevated: stay in the shelter or enter before advancing.",
  "Se acerca una tormenta de polvo: ahorra batería antes del próximo avance.": "A dust storm is coming: save battery before the next advance.",
  "Reserva principal de oxígeno baja.": "Main oxygen supply is low.",
  "Reserva principal de agua baja.": "Main water supply is low.",
  "Alimentos bajos.": "Food is low.",
  "Batería baja.": "Battery is low.",
};
export const localizeAlert = (text: string, locale: string) => (locale === "en" ? (ALERTS_EN[text] ?? text) : text);

/** Animación de la tripulación según el estado general. */
export function crewAnim(m: MissionView): string {
  if (m.state.status === "completed") return "celebrate";
  if (m.state.crew_health_pct < 50) return "sick";
  return "idle";
}
