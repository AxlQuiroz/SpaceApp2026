/**
 * Traduce el estado del backend (MissionView) a lo que dibuja el HUD.
 * Aquí NO hay reglas de simulación: sólo presentación del estado confirmado.
 */
import type { MissionView, TimelineEvent } from "@/lib/orbita/schema";
import type { IconName, SpriteName } from "@/sprites/sprites.config";
import type { SpaceWeatherLevel } from "@/components/hud";
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

/** Orden fijo de la tarjeta de comandos: Q W E / A S D / Z X C. */
export const COMMAND_LAYOUT: { id: ActionId; icon: IconName }[] = [
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

/** Umbrales de alerta: los mismos que usa el backend para sus `alerts` (rules lunar-1.0.0). */
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
      sprite: { name: "oxygenGen", anim: sy.oxygen_generator_on ? "on" : "off" },
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

/** Clima espacial del turno actual, a partir de los eventos ya ocurridos. */
export function spaceWeather(m: MissionView, log: TimelineEvent[]): SpaceWeatherLevel {
  const turn = m.state.turn;
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
/* Actividad visual tras una acción (sólo presentación, ~3 s)          */
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
};

/** Traducciones de las alertas del backend (que llegan en español). */
const ALERTS_EN: Record<string, string> = {
  "Fuga activa: el agua se pierde cada turno hasta repararla.": "Active leak: water is lost every turn until it's fixed.",
  "Paneles dañados: la producción eléctrica está reducida.": "Damaged panels: power production is reduced.",
  "El próximo avance incluye un incidente solar simulado: considera entrar al refugio.":
    "The next advance brings a solar storm: consider going to the shelter.",
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
