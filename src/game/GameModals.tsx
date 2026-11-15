"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
}: {
  evaluation: Evaluation | null;
  onAgain: () => void;
  onMenu: () => void;
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
        <div className="flex flex-wrap justify-end gap-2">
          <PixelButton variant="ghost" onClick={onMenu}>
            {t.end.menu}
          </PixelButton>
          {/* data-autofocus: un Enter accidental no debe sacar al jugador de su resultado */}
          <PixelButton data-autofocus variant="primary" onClick={onAgain} icon={<PixelSprite icon="next" scale={2} />}>
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

  useEffect(() => {
    if (!open || bundle) return;
    load()
      ?.then(setBundle)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [open, bundle, load]);

  return (
    <Modal open={open} title={t.sources.title} onClose={onClose}>
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-2">
        <p className="text-steel-200">{t.sources.intro}</p>
        {!bundle && !err && <p className="blink">{t.sources.loading}</p>}
        {err && <p className="text-alert">{err}</p>}
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
          </article>
        ))}
        {bundle && <p className="text-base text-steel-400">{bundle.notice}</p>}
        <p className="font-tiny text-xs text-steel-400">{t.sources.credits}</p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Glosario                                                            */
/* ------------------------------------------------------------------ */

export function GlossaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal open={open} title={t.glossary.title} onClose={onClose}>
      <dl className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-2">
        {t.glossary.items.map(([term, def]) => (
          <div key={term}>
            <dt className="font-pixel text-lg text-neon-cyan">{term}</dt>
            <dd className="text-steel-200">{def}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Tutorial guiado: resalta una zona del HUD por paso                  */
/* ------------------------------------------------------------------ */

export const TOUR_TARGETS = ["resources", "base", "commands", "advance", "crew"] as const;

export function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const last = step === TOUR_TARGETS.length - 1;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    // Puede haber dos objetivos (escritorio y dock móvil): usamos el que está visible.
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${TOUR_TARGETS[step]}"]`)].find(
      (n) => n.getClientRects().length > 0,
    );
    const update = () => setRect(el?.getBoundingClientRect() ?? null);
    el?.scrollIntoView({ block: "nearest" });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    nextRef.current?.focus();
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const pad = 6;
  // Caja de texto en la mitad opuesta a la zona resaltada
  const boxAtTop = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.game.tutorial}>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(10 14 22 / 0.78)",
            outline: "calc(var(--px) * 2) solid var(--color-neon-cyan)",
          }}
        />
      )}
      <div className={`absolute inset-x-0 mx-auto w-[min(94vw,640px)] ${boxAtTop ? "top-4" : "bottom-4"}`}>
        <div className="bevel rivets flex gap-3" style={{ padding: "calc(var(--px) * 5)" }}>
          <div className="bevel-inset shrink-0 self-start p-2">
            <PixelSprite sprite="robot" anim="talk" scale={4} label="R0-B1" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <span className="font-tiny text-xs text-steel-400">
              {step + 1} / {TOUR_TARGETS.length}
            </span>
            <p className="text-xl" aria-live="polite">
              {t.tutorial.steps[step]}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <PixelButton variant="ghost" onClick={onClose}>
                {t.tutorial.skip}
              </PixelButton>
              <PixelButton
                ref={nextRef}
                variant="primary"
                onClick={() => (last ? onClose() : setStep((s) => s + 1))}
              >
                {last ? t.tutorial.done : t.tutorial.next}
              </PixelButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
