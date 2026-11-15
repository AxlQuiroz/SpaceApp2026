"use client";

import type { MissionView } from "@/lib/orbita/schema";
import { useI18n } from "@/lib/providers";
import { flightText } from "./flightText";
import { reviewText } from "./reviewText";
import type { ScenarioParams } from "./useMission";

export function MissionPlan({ mission, parameters }: { mission: MissionView; parameters: ScenarioParams }) {
  const { locale, t } = useI18n(), c = flightText(locale), review = reviewText(locale);
  const s = mission.state, planning = mission.planning, mars = s.scenario_id.startsWith("mars");
  const goals = [
    { label: c.duration, value: `${s.turn}/${parameters.turns}`, target: `${parameters.turns * 2} h`, met: s.turn >= parameters.turns },
    { label: c.health, value: `${Math.round(s.crew_health_pct)}`, target: "≥ 60", met: s.crew_health_pct >= 60 },
    { label: c.science, value: `${s.science_points}/${parameters.science_target}`, target: `${parameters.science_target}`, met: s.science_points >= parameters.science_target },
    ...(planning ? [{ label: c.food, value: `${s.resources.food_kg.toFixed(2)} kg`, target: `≥ ${planning.food_reserve_target_kg.toFixed(1)} kg`, met: s.resources.food_kg >= planning.food_reserve_target_kg }] : []),
  ];
  return <aside className="bevel-inset min-w-0 px-3 py-2" aria-label={c.goals}>
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
      {goals.map(goal => <div key={goal.label} className="min-w-0">
        <p className="text-sm text-steel-200">{goal.label}</p>
        <p className="font-pixel text-lg tabular-nums">{goal.value} <span className={`text-xs ${goal.met ? "text-lime" : "text-amber"}`}>{c.reserve} {goal.target}</span></p>
      </div>)}
    </div>
    <details className="mt-1 text-base"><summary className="cursor-pointer py-1 text-neon-cyan">{c.details}</summary>
      <div className="flex flex-col gap-1 pb-1 text-steel-200">
        <p>{s.practice_mode === "training" ? review.training : review.historicalMode} · {s.rules_version} · {c.seed}: {s.seed}</p>
        {planning && <p>{c.harvest}: {planning.food_autonomy_hours.toFixed(1)} h. {review.harvestNote}</p>}
        {mars && <p>{c.radio}: {s.reported_data_points ?? 0}/12 · {c.data}: {s.unreported_data_points ?? 0}. {review.radioNote}</p>}
        {planning?.pending_reply_minutes != null && <p className="text-amber">{review.pendingRadio}: {planning.pending_reply_minutes} {review.minutes}</p>}
        <p>{t.game.exposureNote}</p>
      </div>
    </details>
    {planning?.pending_reply_minutes != null && <p className="text-base text-amber" role="status">{review.pendingRadio}: {planning.pending_reply_minutes} {review.minutes}</p>}
  </aside>;
}
