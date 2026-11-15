"use client";

import { useEffect, useState } from "react";
import { Badge, Modal, PixelButton, PixelSprite } from "@/components/hud";
import type { Evaluation, ScienceBundle } from "@/lib/orbita/schema";
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
}: {
  evaluation: Evaluation | null;
  onAgain: () => void;
  onMenu: () => void;
  busy?: boolean;
  hasPending?: boolean;
  error?: string | null;
  onRetry?: () => void;
  retryIn?: number;
}) {
  const { t } = useI18n();
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
                <Badge tone={ok ? "ok" : "bad"}>{OBJECTIVE_LABEL[k] ? t.end[OBJECTIVE_LABEL[k]] : k}</Badge>
              </li>
            ))}
          </ul>
        </section>
        {evaluation.feedback.length > 0 && (
          <section>
            <h3 className="font-pixel mb-1 text-lg text-neon-cyan">{t.end.tips}</h3>
            <ul className="list-inside list-disc text-steel-200">
              {evaluation.feedback.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        )}
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

export function SourcesModal({ open, onClose, load }: { open: boolean; onClose: () => void; load: () => Promise<ScienceBundle> | null }) {
  const { t } = useI18n();
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
        {err && <div role="alert"><p className="text-alert">{err}</p><PixelButton onClick={() => setAttempt(n => n + 1)}>{t.menu.retry}</PixelButton></div>}
        {bundle?.sources.map((s) => (
          <article key={s.id} className="bevel-inset p-3">
            <h3 className="font-pixel text-lg text-amber">{s.id}</h3>
            <p className="text-lg">
              <span className="text-steel-400">{t.sources.role}: </span>
              {s.role}
            </p>
            <p className="text-lg text-steel-200">{s.interpretation}</p>
            <p className="font-tiny mt-1 text-xs text-steel-400">
              {s.records.length} {t.sources.records}
            </p>
            {s.pages_meta.map((meta, index) => {
              const url = typeof meta.source_url === "string" && /^https:\/\//.test(meta.source_url) ? meta.source_url : null;
              return (
                <div key={index} className="mt-2 break-words text-base text-steel-200">
                  {typeof meta.attribution === "string" && <p>{meta.attribution}</p>}
                  {typeof meta.retrieval_mode === "string" && <p>{t.sources.mode}: {meta.retrieval_mode}</p>}
                  {typeof meta.retrieved_at === "string" && <p>{t.sources.retrieved}: {meta.retrieved_at}</p>}
                  {url && <a className="text-neon-cyan underline" href={url} target="_blank" rel="noopener noreferrer">{t.sources.original}</a>}
                  {Array.isArray(meta.warnings) && meta.warnings.filter((w): w is string => typeof w === "string").map(w => <p key={w} className="text-amber">{w}</p>)}
                </div>
              );
            })}
          </article>
        ))}
        {bundle && <p className="text-base text-steel-400">{bundle.notice}</p>}
        <p className="font-tiny text-xs text-steel-400">{t.sources.credits}</p>
      </div>
    </Modal>
  );
}
