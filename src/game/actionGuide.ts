/**
 * Ayudas para que niñas y niños entiendan las acciones: etiqueta corta de efecto,
 * razón de bloqueo en lenguaje sencillo y la sugerencia de R0-B1.
 * Sólo PRESENTACIÓN: quién puede hacer qué lo decide siempre el backend
 * (`available_actions[].enabled`); aquí sólo se explica con otras palabras.
 */
import type { MissionView } from "@/lib/orbita/schema";
import type { SpaceWeatherLevel } from "@/components/hud";
import type { Dict } from "@/i18n/dictionaries";
import { DANGER } from "./model";
import type { ActionId } from "./useMission";

export type ActionTag = { text: string; tone: "good" | "on" | "off" | "warn" | "muted" };

/** Etiqueta corta que dice qué hace la acción ("+ ciencia", "Encender"…). */
export function actionTag(t: Dict, m: MissionView, id: ActionId): ActionTag {
  const tags = t.commands.tags;
  const sy = m.state.systems;
  switch (id) {
    case "toggle_oxygen_generator":
      return sy.oxygen_generator_on ? { text: tags.turnOff, tone: "off" } : { text: tags.turnOn, tone: "on" };
    case "toggle_greenhouse":
      return sy.greenhouse_on ? { text: tags.turnOff, tone: "off" } : { text: tags.turnOn, tone: "on" };
    case "activate_oxygen_reserve":
    case "activate_water_reserve":
      return { text: tags.reserve, tone: "warn" };
    default:
      return { text: tags[id], tone: "good" };
  }
}

const RESOURCE_NAMES = (t: Dict): Record<string, string> => ({
  energy_kwh: t.resources.energy,
  oxygen_kg: t.resources.oxygen,
  water_l: t.game.water,
  food_kg: t.game.food,
  spare_parts: t.game.parts,
});

/**
 * Traduce la razón del backend (en español técnico) a una frase para niños,
 * en el idioma activo. Si no se reconoce, se muestra un texto genérico.
 */
export function reasonText(t: Dict, reason: string | null | undefined, actionsLeft: number): string {
  const r = t.commands.reasons;
  if (actionsLeft <= 0) return r.noActions;
  if (!reason) return r.other;
  const missing = /^Recurso insuficiente: (\w+)\.?$/.exec(reason);
  if (missing) return `${r.missing} ${(RESOURCE_NAMES(t)[missing[1]] ?? missing[1]).toLowerCase()}.`;
  const known: [string, string][] = [
    ["acciones de este turno", r.noActions],
    ["debe estar activa", r.inactive],
    ["No hay una fuga", r.noLeak],
    ["ya están reparados", r.panelsOk],
    ["ya está en el refugio", r.alreadyIn],
    ["ya está fuera del refugio", r.alreadyOut],
    ["está en el refugio", r.inShelter],
    ["depósito de oxígeno", r.oxygenReserve],
    ["depósito de agua", r.waterReserve],
    ["respuesta de la Tierra", r.waitingEarth],
  ];
  return known.find(([needle]) => reason.includes(needle))?.[1] ?? r.other;
}

/**
 * La acción que R0-B1 recomienda ahora mismo y por qué, o null si no hay urgencias.
 * Sólo mira problemas visibles (alertas, recursos bajos); nunca elige por el niño.
 */
export function suggestAction(
  t: Dict,
  m: MissionView,
  weather: SpaceWeatherLevel,
): { id: ActionId; why: string } | null {
  const s = m.state;
  const sy = s.systems;
  const r = s.resources;
  const why = t.commands.why;
  const enabled = new Set(m.available_actions.filter((a) => a.enabled).map((a) => a.id as ActionId));
  // Aviso de radiación: el backend lo anuncia como alerta que menciona el refugio.
  // En "tormenta" la radiación del turno ya pasó: no se sugiere ni entrar ni salir.
  const warned = m.alerts.some((a) => a.includes("refugio")) || weather === "active";
  const calm = !warned && weather === "calm";
  const candidates: [boolean, ActionId, string][] = [
    [warned && !sy.crew_in_shelter, "enter_shelter", why.shelter_warning],
    [sy.water_leak_active, "repair_water_loop", why.leak],
    [r.oxygen_kg < DANGER.oxygen_kg && !sy.oxygen_generator_on, "toggle_oxygen_generator", why.oxygen_off],
    [r.oxygen_kg < DANGER.oxygen_kg, "activate_oxygen_reserve", why.oxygen_low],
    [r.water_l < DANGER.water_l, "activate_water_reserve", why.water_low],
    [r.energy_kwh < DANGER.energy_kwh && sy.greenhouse_on, "toggle_greenhouse", why.energy_low],
    [sy.solar_integrity_pct < 100 && !sy.dust_storm_active, "repair_solar_panels", why.panels],
    [r.food_kg < DANGER.food_kg && !sy.greenhouse_on, "toggle_greenhouse", why.food_low],
    // Objetivo "conservar alimento para mañana": avisar antes de que sea tarde, si sobra batería.
    [
      !!m.planning && r.food_kg < m.planning.food_reserve_target_kg + 1 && !sy.greenhouse_on && r.energy_kwh >= DANGER.energy_kwh * 2,
      "toggle_greenhouse",
      why.food_target,
    ],
    [sy.crew_in_shelter && calm, "leave_shelter", why.safe_now],
  ];
  const hit = candidates.find(([when, id]) => when && enabled.has(id));
  return hit ? { id: hit[1], why: hit[2] } : null;
}

/** "Gasta: 2 kWh de energía · 2 repuestos", o "No gasta recursos". */
export function costText(t: Dict, costs: Record<string, number>): string {
  const names = RESOURCE_NAMES(t);
  const units: Record<string, [string, number]> = {
    energy_kwh: ["kWh", 1],
    oxygen_kg: ["kg", 2],
    water_l: ["L", 1],
    food_kg: ["kg", 1],
    spare_parts: ["", 0],
  };
  const parts = Object.entries(costs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const [unit, d] = units[k] ?? ["", 1];
      return `${v.toFixed(d)}${unit ? ` ${unit}` : ""} ${(names[k] ?? k).toLowerCase()}`;
    });
  return parts.length ? `${t.commands.spends}: ${parts.join(" · ")}` : t.commands.free;
}
