"use client";

import { useEffect, useState } from "react";
import { Badge, Modal, PixelButton, PixelSprite } from "@/components/hud";
import type { ActionOption, Evaluation, ScienceBundle } from "@/lib/orbita/schema";
import { feedbackText, missionErrorText, reviewText, sourceText, warningText } from "./reviewText";
import { useAudio, useI18n } from "@/lib/providers";

/* ------------------------------------------------------------------ */
/* Fin de misión                                                       */
/* ------------------------------------------------------------------ */

const OBJECTIVE_LABEL: Record<string, "obj_completed" | "obj_health" | "obj_science"> = {
  completed_duration: "obj_completed",
  healthy_crew: "obj_health",
  science_target: "obj_science",
};

export function EndModal({
  evaluation,
  onAgain,
  onMenu,
  busy = false,
  hasPending = false,
  error,
  onRetry,
  retryIn = 0,
  actionName,
}: {
  evaluation: Evaluation | null;
  onAgain: () => void;
  onMenu: () => void;
  busy?: boolean;
  hasPending?: boolean;
  error?: string | null;
  onRetry?: () => void;
  retryIn?: number;
  actionName?: (id: ActionOption["id"]) => string;
}) {
  const { t, locale } = useI18n();
  const copy = reviewText(locale);
  const { play } = useAudio();
  const open = !!evaluation?.final;
  const outcome = evaluation?.outcome ?? "in_progress";

  useEffect(() => {
    if (open) play(outcome === "success" ? "success" : "error");
  }, [open, outcome, play]);

  if (!evaluation) return null;
  const title = outcome === "in_progress" ? "" : t.end[outcome];
  return (
    <Modal open={open} title={title} onClose={onMenu}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <PixelSprite sprite="astronaut" anim={outcome === "success" ? "celebrate" : outcome === "failed" ? "sick" : "idle"} scale={5} />
          <div>
            <span className="font-tiny text-sm text-steel-200 uppercase">{t.end.score}</span>
            <p className="font-pixel text-6xl text-amber">{Math.round(evaluation.score)}</p>
          </div>
        </div>
        <section>
          <h3 className="font-pixel mb-1 text-lg text-neon-cyan">{t.end.objectives}</h3>
          <ul className="flex flex-col gap-1">
            {Object.entries(evaluation.objectives).map(([k, ok]) => (
              <li key={k}>
                <Badge tone={ok ? "ok" : "bad"}>{OBJECTIVE_LABEL[k] ? t.end[OBJECTIVE_LABEL[k]] : copy.objectives[k] ?? k}</Badge>
              </li>
            ))}
          </ul>
        </section>
        {evaluation.feedback.length > 0 && (
          <section>
            <h3 className="font-pixel mb-1 text-lg text-neon-cyan">{t.end.tips}</h3>
            <ul className="list-inside list-disc text-steel-200">
              {evaluation.feedback.map((f, index) => (
                <li key={f}>{feedbackText(evaluation.feedback_codes?.[index], f, locale)}</li>
              ))}
            </ul>
          </section>
        )}
        {evaluation.comparison && <section className="bevel-inset p-3" aria-label={copy.sameCase}>
          <h3 className="font-pixel text-xl text-neon-cyan">{copy.sameCase}</h3>
          <p className="text-base">{copy.comparisonNote}</p>
          <p>{copy.duration}: {evaluation.comparison.previous_turns} → {evaluation.comparison.current_turns}</p>
          <dl className="grid grid-cols-2 gap-1 text-lg">{[
            [copy.score, evaluation.comparison.score_delta, ""],
            [copy.health, evaluation.comparison.health_delta, ""],
            [copy.exposure, evaluation.comparison.exposure_delta, ""],
            [copy.food, evaluation.comparison.food_delta_kg, "kg"],
            [copy.energy, evaluation.comparison.energy_delta_kwh, "kWh"],
          ].map(([label, value, unit]) => <div key={String(label)}><dt>{label}</dt><dd className="text-amber">{Number(value) > 0 ? "+" : ""}{Number(value).toFixed(1)} {unit}</dd></div>)}</dl>
          <details><summary className="cursor-pointer py-2">{copy.changed}</summary><ul className="text-base">{evaluation.comparison.decisions.map(d => <li key={d.turn}>{copy.turn} {d.turn}: {d.previous.map(id => actionName?.(id) ?? id).join(", ") || copy.none} → {d.current.map(id => actionName?.(id) ?? id).join(", ") || copy.none}</li>)}</ul></details>
        </section>}
        {error && <div role="alert"><p className="text-alert">{error}</p>{onRetry && <PixelButton disabled={busy || retryIn > 0} onClick={onRetry}>{t.menu.retry}{retryIn > 0 ? ` (${retryIn}s)` : ""}</PixelButton>}</div>}
        <div className="flex flex-wrap justify-end gap-2">
          <PixelButton disabled={busy || hasPending} variant="ghost" onClick={onMenu}>
            {t.end.menu}
          </PixelButton>
          {/* data-autofocus: un Enter accidental no debe sacar al jugador de su resultado */}
          <PixelButton disabled={busy || hasPending} data-autofocus variant="primary" onClick={onAgain} icon={<PixelSprite icon="next" scale={2} />}>
            {t.end.again}
          </PixelButton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Fuentes NASA y créditos                                             */
/* ------------------------------------------------------------------ */

export function SourcesModal({ open, onClose, load, scenarioId = "lunar-outpost-v1" }: { open: boolean; onClose: () => void; load: () => Promise<ScienceBundle> | null; scenarioId?: string }) {
  const { t, locale } = useI18n();
  const copy = reviewText(locale);
  const [bundle, setBundle] = useState<ScienceBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || bundle) return;
    let cancelled = false;
    setErr(null);
    load()
      ?.then(value => { if (!cancelled) setBundle(value); })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [open, bundle, load, attempt]);

  return (
    <Modal open={open} title={t.sources.title} onClose={onClose}>
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-2">
        <p className="text-steel-200">{t.sources.intro}</p>
        {!bundle && !err && <p className="blink">{t.sources.loading}</p>}
        {err && <div role="alert"><p className="text-alert">{missionErrorText(err, locale)}</p><PixelButton onClick={() => setAttempt(n => n + 1)}>{t.menu.retry}</PixelButton></div>}
        {bundle?.id === "demo" && <p className="text-amber">{t.menu.demoNote}</p>}
        {bundle?.id !== "demo" && bundle?.sources.map((s) => (
          <article key={s.id} className="bevel-inset p-3">
            <h3 className="font-pixel text-lg text-amber">{sourceText(s.id, scenarioId.startsWith("mars"), locale).title}</h3>
            <p className="text-lg">
              <span className="text-steel-400">{t.sources.role}: </span>
              {sourceText(s.id, scenarioId.startsWith("mars"), locale).title}
            </p>
            <p className="text-lg text-steel-200">{sourceText(s.id, scenarioId.startsWith("mars"), locale).detail}</p>
            <p className="font-tiny mt-1 text-xs text-steel-400">
              {s.records.length} {t.sources.records}
            </p>
            {s.records.some(r => typeof r.observed_at === "string") && <p className="text-base text-neon-cyan">{copy.historical} · {copy.observed}: {s.records.map(r => r.observed_at).filter((x): x is string => typeof x === "string").sort()[0]} — {s.records.map(r => r.observed_at).filter((x): x is string => typeof x === "string").sort().at(-1)}</p>}
            {s.pages_meta.map((meta, index) => {
              const url = typeof meta.source_url === "string" && /^https:\/\//.test(meta.source_url) ? meta.source_url : null;
              return (
                <div key={index} className="mt-2 break-words text-base text-steel-200">
                  {typeof meta.attribution === "string" && <p>{meta.attribution}</p>}
                  {typeof meta.retrieval_mode === "string" && <p>{t.sources.mode}: {meta.retrieval_mode === "snapshot" ? copy.historical : locale === "en" ? "Downloaded or cached historical records" : "Registros históricos descargados o en caché"}</p>}
                  {typeof meta.retrieved_at === "string" && <p>{copy.downloaded}: {meta.retrieved_at}</p>}
                  {url && <a className="text-neon-cyan underline" href={url} target="_blank" rel="noopener noreferrer">{t.sources.original}</a>}
                  {Array.isArray(meta.warnings) && meta.warnings.filter((w): w is string => typeof w === "string").map(w => <p key={w} className="text-amber">{warningText(w, locale)}</p>)}
                </div>
              );
            })}
          </article>
        ))}
        {bundle && <p className="text-base text-steel-400">{t.sources.intro}</p>}
        {!!bundle?.model_derivations?.mars_radiation && <details className="break-all text-base"><summary className="cursor-pointer py-2">{copy.provenance}</summary><pre className="whitespace-pre-wrap">{JSON.stringify(bundle.model_derivations.mars_radiation, null, 2)}</pre></details>}
        <p className="text-base text-steel-200">{copy.aiCredit}</p>
        <p className="font-tiny text-xs text-steel-400">{t.sources.credits}</p>
      </div>
    </Modal>
  );
}
