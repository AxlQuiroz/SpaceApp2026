import type { Locale } from "@/i18n/dictionaries";
import type { MissionView } from "@/lib/orbita/schema";
import type { ActionId } from "./useMission";
import { flightText } from "./flightText";

export type ActionGroup = "research" | "systems" | "protection";
export function actionGroup(id: ActionId): ActionGroup {
  if (id === "explore" || id === "contact_earth") return "research";
  if (id.startsWith("repair_") || id.startsWith("toggle_")) return "systems";
  return "protection";
}

/** Sólo describe el estado confirmado. No calcula resultados ni adelanta incidentes. */
export function actionAvailability(m: MissionView, id: ActionId, locale: Locale) {
  const c = flightText(locale), s = m.state, r = s.resources, sy = s.systems;
  if (s.status === "paused") return c.paused;
  if (s.status !== "active") return c.finished;
  const option = m.available_actions.find(a => a.id === id);
  if (option?.enabled) return null;
  if (s.actions_used >= 2) return c.noActions;
  if (id === "repair_water_loop" && !sy.water_leak_active) return c.noLeak;
  if (id === "repair_solar_panels" && sy.solar_integrity_pct >= 100) return c.panelsOk;
  if ((id === "explore" || id === "repair_solar_panels") && sy.crew_in_shelter) return c.sheltered;
  if (id === "enter_shelter" && sy.crew_in_shelter) return c.alreadySheltered;
  if (id === "leave_shelter" && !sy.crew_in_shelter) return c.alreadyOutside;
  if (id === "activate_oxygen_reserve") return r.reserve_oxygen_kg <= 0 ? c.tankEmpty : c.tankFull;
  if (id === "activate_water_reserve") return r.reserve_water_l <= 0 ? c.tankEmpty : c.tankFull;
  if (id === "contact_earth" && sy.earth_message_pending) return c.replyPending;
  return c.insufficient;
}

export function decisionGuidance(m: MissionView, locale: Locale, radiationWarning: boolean) {
  const c = flightText(locale), s = m.state, r = s.resources, sy = s.systems;
  const tip = (text: string, action: ActionId | null = null) => ({text, action});
  if (s.status === "paused") return tip(c.paused);
  if (s.status !== "active") return tip(c.finished);
  if (radiationWarning && !sy.crew_in_shelter) return tip(c.solar, "enter_shelter");
  if (r.oxygen_kg < 0.8) return tip(c.lowOxygen, r.reserve_oxygen_kg > 0 ? "activate_oxygen_reserve" : !sy.oxygen_generator_on ? "toggle_oxygen_generator" : null);
  if (sy.water_leak_active) return tip(c.leak, "repair_water_loop");
  if (r.water_l < 4) return tip(c.lowWater, "activate_water_reserve");
  if (r.energy_kwh < 8) return tip(c.lowPower);
  if (r.food_kg < (m.planning?.food_reserve_target_kg ?? 0.8) + 0.3) return tip(c.lowFood, !sy.greenhouse_on ? "toggle_greenhouse" : null);
  if (sy.solar_integrity_pct < 100 && !sy.crew_in_shelter) return tip(c.damaged, "repair_solar_panels");
  if (s.scenario_id === "mars-outpost-v1" && s.unreported_data_points > 0 && !sy.earth_message_pending) return tip(c.dataReady, "contact_earth");
  if (sy.crew_in_shelter) return tip(c.shelterNote);
  return tip(c.calm);
}
