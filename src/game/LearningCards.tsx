"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Modal, PixelButton, PixelSprite } from "@/components/hud";
import type { PreviewResult } from "@/lib/orbita/schema";
import { useFocusTrap } from "@/lib/hooks";
import { reviewText } from "./reviewText";
import { useAudio, useI18n } from "@/lib/providers";
import type { IconName } from "@/sprites/sprites.config";
import { suitForMedal } from "./wardrobe";
import { MEDALS, TERMS, type Lang, type Medal, type Progress, type Quiz, type Term } from "./learning";

/* ------------------------------------------------------------------ */
/* Marco común: R0-B1 a la izquierda, contenido a la derecha           */
/* ------------------------------------------------------------------ */

function RobotCard({ tag, tone, children, talking = false }: { tag: string; tone: string; children: ReactNode; talking?: boolean }) {
  const trap = useFocusTrap<HTMLElement>();
  return (
    <section ref={trap} role="dialog" aria-modal="true" aria-label={tag} className="bevel rivets pop-in flex gap-3" style={{ padding: "calc(var(--px) * 5)" }}>
      <div className="bevel-inset scanlines shrink-0 self-start p-2">
        <PixelSprite sprite="robot" anim={talking ? "talk" : "idle"} scale={4} label="R0-B1" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-tiny self-start px-2 py-0.5 text-xs text-void uppercase" style={{ background: tone }}>
          {tag}
        </span>
        {children}
      </div>
    </section>
  );
}

/** Enfoca el botón principal de la tarjeta para que Enter la cierre. */
function useAutoFocus<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    const target = element?.matches(":disabled")
      ? element.closest('[role="dialog"]')?.querySelector<HTMLElement>('button:not(:disabled)')
      : element;
    target?.focus({ preventScroll: true });
  }, [dep]);
  return ref;
}

/* ------------------------------------------------------------------ */
/* Palabra nueva                                                       */
/* ------------------------------------------------------------------ */

export function TermCard({ term, onClose }: { term: Term; onClose: () => void }) {
  const { t, locale } = useI18n();
  const ok = useAutoFocus<HTMLButtonElement>(term.id);
  const lang = locale as Lang;
  return (
    <RobotCard tag={t.learn.newWord} tone="var(--color-lime)" talking>
      <h2 className="font-pixel flex items-center gap-2 text-2xl text-neon-cyan">
        <PixelSprite icon={term.icon} scale={2} />
        {term.term[lang]}
      </h2>
      <p className="text-xl text-steel-50">{term.text[lang]}</p>
      <div className="flex justify-end">
        <PixelButton ref={ok} variant="primary" onClick={onClose}>
          {t.dialog.ok}
        </PixelButton>
      </div>
    </RobotCard>
  );
}

/* ------------------------------------------------------------------ */
/* Mini-pregunta: sin castigo; siempre termina con la explicación      */
/* ------------------------------------------------------------------ */

export function QuizCard({ quiz, onAnswer, onClose }: { quiz: Quiz; onAnswer: (correct: boolean) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { play } = useAudio();
  const lang = locale as Lang;
  const [picked, setPicked] = useState<number | null>(null);
  const ok = useAutoFocus<HTMLButtonElement>(picked);
  const correct = picked === quiz.answer;

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    play(i === quiz.answer ? "success" : "click");
    onAnswer(i === quiz.answer);
  };

  return (
    <RobotCard tag={t.learn.quiz} tone="var(--color-amber)" talking={picked === null}>
      <h2 className="text-xl text-steel-50">{quiz.question[lang]}</h2>
      <ul className="flex flex-col gap-2">
        {quiz.options.map((option, i) => {
          const state = picked === null ? "idle" : i === quiz.answer ? "right" : i === picked ? "wrong" : "idle";
          return (
            <li key={i}>
              <button
                type="button"
                // aria-disabled (no disabled): así la respuesta correcta conserva su color verde.
                aria-disabled={picked !== null || undefined}
                onClick={() => choose(i)}
                className={`bevel pixel-btn flex w-full items-center gap-2 px-3 py-2 text-left text-lg ${picked !== null ? "cursor-default" : ""} ${state === "wrong" ? "opacity-60" : ""}`}
                style={{
                  ["--bevel-fill" as string]:
                    state === "right" ? "var(--color-lime-dark)" : state === "wrong" ? "var(--color-alert-dark)" : "var(--color-steel-800)",
                }}
              >
                <span className="font-pixel text-amber" aria-hidden>
                  {state === "right" ? "✓" : state === "wrong" ? "✗" : "ABC"[i]}
                </span>
                {option[lang]}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="text-lg">
            <strong className={`font-pixel ${correct ? "text-lime" : "text-amber"}`}>
              {correct ? t.learn.correct : `${t.learn.almost} ${quiz.options[quiz.answer][lang]}.`}
            </strong>{" "}
            {quiz.explain[lang]}
          </p>
          <div className="flex justify-end">
            <PixelButton ref={ok} variant="primary" onClick={onClose}>
              {t.dialog.ok}
            </PixelButton>
          </div>
        </div>
      )}
    </RobotCard>
  );
}

/* ------------------------------------------------------------------ */
/* Medalla nueva                                                       */
/* ------------------------------------------------------------------ */

export function MedalCard({ medal, onClose }: { medal: Medal; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { play } = useAudio();
  const lang = locale as Lang;
  const ok = useAutoFocus<HTMLButtonElement>(medal.id);
  useEffect(() => play("success"), [medal.id, play]);
  return (
    <RobotCard tag={t.learn.medal} tone="var(--color-amber)">
      <div className="flex items-center gap-3">
        <div className="bevel-inset glow p-2">
          <PixelSprite icon={medal.icon} scale={4} />
        </div>
        <div>
          <h2 className="font-pixel text-2xl text-amber">{medal.name[lang]}</h2>
          <p className="text-lg text-steel-200">{medal.how[lang]}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <PixelButton ref={ok} variant="primary" onClick={onClose}>
          {t.dialog.ok}
        </PixelButton>
      </div>
    </RobotCard>
  );
}

/* ------------------------------------------------------------------ */
/* "¿Qué pasaría si…?": vista previa calculada por el backend          */
/* ------------------------------------------------------------------ */

const PREVIEW_ROWS: { key: string; icon: IconName; unit: string; d: number }[] = [
  { key: "energy_kwh", icon: "energy", unit: "kWh", d: 1 },
  { key: "oxygen_kg", icon: "oxygen", unit: "kg", d: 2 },
  { key: "water_l", icon: "food", unit: "L", d: 1 },
  { key: "food_kg", icon: "ration", unit: "kg", d: 2 },
  { key: "spare_parts", icon: "gear", unit: "", d: 0 },
  { key: "reserve_oxygen_kg", icon: "tank", unit: "kg", d: 1 },
  { key: "reserve_water_l", icon: "tank", unit: "L", d: 1 },
];

type PreviewProps = {
  label: string;
  hint: string;
  icon: IconName;
  /** null mientras se calcula; "error" si el backend no pudo responder */
  result: PreviewResult | "error" | null;
  current: { resources: Record<string, number>; science_points: number; exposure_risk_index: number };
  names: Record<string, string>;
  note?: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry?: () => void;
  onShelter?: () => void;
};

export function PreviewPanel({ label, hint, icon, result, current, names, note, busy, onConfirm, onCancel, onRetry, onShelter }: PreviewProps) {
  const { t, locale } = useI18n();
  const copy = reviewText(locale);
  const trap = useFocusTrap<HTMLElement>();
  const forecast = result && result !== "error" ? result.forecast : null;
  const failed = result === "error" || (result !== null && !forecast);
  const ok = useAutoFocus<HTMLButtonElement>(result);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // `up` es la dirección del cambio (flecha); `good` decide el color (verde = bueno, rojo = malo).
  const rows: { key: string; icon: IconName; text: string; up: boolean; good: boolean }[] = [];
  if (result && result !== "error") {
    const after = result.result.mission.state;
    for (const row of PREVIEW_ROWS) {
      const diff = (after.resources as Record<string, number>)[row.key] - current.resources[row.key];
      if (Math.abs(diff) < 10 ** -row.d / 2) continue;
      rows.push({ key: row.key, icon: row.icon, up: diff > 0, good: diff > 0, text: `${names[row.key]} ${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(row.d)} ${row.unit}` });
    }
    const science = after.science_points - current.science_points;
    if (science) rows.push({ key: "science", icon: "explore", up: science > 0, good: science > 0, text: `${t.preview.science} ${science > 0 ? "+" : "−"}${Math.abs(science)}` });
    const exposure = after.exposure_risk_index - current.exposure_risk_index;
    // Más exposición es malo: flecha hacia arriba pero en rojo.
    if (Math.abs(exposure) >= 0.05)
      rows.push({ key: "exposure", icon: "warning", up: exposure > 0, good: exposure < 0, text: `${t.preview.exposure} ${exposure > 0 ? "+" : "−"}${Math.abs(exposure).toFixed(1)}` });
  }

  return (
    <section ref={trap} data-testid="preview" aria-modal="true" role="dialog" aria-label={t.preview.title} className="bevel rivets pop-in flex max-h-[94dvh] flex-col gap-2 overflow-y-auto" style={{ padding: "calc(var(--px) * 5)" }}>
      <span className="font-tiny self-start bg-neon-cyan px-2 py-0.5 text-xs text-void uppercase">{t.preview.title}</span>
      <h2 className="font-pixel flex items-center gap-2 text-2xl text-neon-cyan">
        <PixelSprite icon={icon} scale={2} />
        {label}
      </h2>
      <p className="text-lg whitespace-pre-line text-steel-200">{hint}</p>
      <div className="bevel-inset min-h-16 p-3" aria-live="polite">
        {result === null && <p className="blink text-lg">{t.preview.loading}</p>}
        {failed && <div role="alert" className="text-alert"><p>{copy.forecastError}</p><PixelButton onClick={onRetry} disabled={busy}>{copy.retry}</PixelButton></div>}
        {!failed && result !== null && rows.length === 0 && <p className="text-lg text-steel-200">{copy.noImmediate}</p>}
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-1 text-lg" style={{ color: row.good ? "var(--color-lime)" : "var(--color-alert)" }}>
              <PixelSprite icon={row.icon} scale={1} />
              <span aria-hidden>{row.up ? "▲" : "▼"}</span>
              {row.text}
            </li>
          ))}
        </ul>
        {note && <p className="mt-1 text-lg text-amber">{note}</p>}
      </div>
      {forecast && !failed && (
        <section aria-label={copy.forecast} className="bevel-inset p-2">
          <h3 className="font-pixel text-lg text-neon-cyan">{copy.forecast}</h3>
          <table className="w-full table-fixed text-base">
            <thead><tr><th className="w-[30%] text-left"></th><th scope="col">{copy.without}</th><th scope="col">{copy.with}</th></tr></thead>
            <tbody>{PREVIEW_ROWS.slice(0, 4).map(row => {
              const before = (forecast.without_action.mission.state.resources as Record<string, number>)[row.key];
              const after = (forecast.with_action.mission.state.resources as Record<string, number>)[row.key];
              return <tr key={row.key}><th scope="row" className="text-left font-normal">{names[row.key]}</th><td className="text-center tabular-nums">{before.toFixed(row.d)} {row.unit}</td><td className={`text-center tabular-nums ${after < before ? "text-amber" : after > before ? "text-lime" : ""}`}>{after.toFixed(row.d)} {row.unit}</td></tr>;
            })}<tr><th scope="row" className="text-left font-normal">{copy.exposure}</th><td className="text-center">{forecast.without_action.mission.state.exposure_risk_index.toFixed(1)}</td><td className="text-center">{forecast.with_action.mission.state.exposure_risk_index.toFixed(1)}</td></tr></tbody>
            <tbody><tr><th scope="row" className="text-left font-normal">{copy.health}</th><td className="text-center">{forecast.without_action.mission.state.crew_health_pct.toFixed(1)}</td><td className="text-center">{forecast.with_action.mission.state.crew_health_pct.toFixed(1)}</td></tr><tr><th scope="row" className="text-left font-normal">{t.preview.science}</th><td className="text-center">{forecast.without_action.mission.state.science_points}</td><td className="text-center">{forecast.with_action.mission.state.science_points}</td></tr></tbody>
          </table>
        </section>
      )}
      <p className="text-base text-steel-200">{t.preview.uses}</p>
      <div className="flex flex-wrap justify-end gap-2">
        {onShelter && <PixelButton disabled={busy} onClick={onShelter}>{copy.shelterFirst}</PixelButton>}
        <PixelButton variant="ghost" onClick={onCancel}>
          {t.preview.cancel}
        </PixelButton>
        <PixelButton ref={ok} variant="primary" disabled={busy || result === null || failed} onClick={onConfirm} icon={<PixelSprite icon="next" scale={2} />}>
          {t.preview.confirm}
        </PixelButton>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bitácora (palabras aprendidas) y medallas                           */
/* ------------------------------------------------------------------ */

export function LogbookModal({ open, onClose, progress }: { open: boolean; onClose: () => void; progress: Progress }) {
  const { t, locale } = useI18n();
  const lang = locale as Lang;
  const known = TERMS.filter((term) => progress.terms.includes(term.id)).length;
  return (
    <Modal open={open} title={`${t.learn.logbook} · ${known} ${t.learn.of} ${TERMS.length} ${t.learn.words}`} onClose={onClose}>
      <p className="mb-2 text-lg text-steel-200">{t.learn.logbookIntro}</p>
      <dl className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-2">
        {TERMS.map((term) => {
          const learned = progress.terms.includes(term.id);
          return (
            <div key={term.id} className={`bevel-inset flex gap-3 p-2 ${learned ? "" : "opacity-60"}`}>
              <PixelSprite icon={learned ? term.icon : "lock"} scale={2} className="shrink-0" />
              <div>
                <dt className="font-pixel text-lg text-neon-cyan">{learned ? term.term[lang] : "???"}</dt>
                <dd className="text-lg text-steel-200">{learned ? term.text[lang] : t.learn.lockedWord}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </Modal>
  );
}

export function MedalsModal({ open, onClose, progress }: { open: boolean; onClose: () => void; progress: Progress }) {
  const { t, locale } = useI18n();
  const lang = locale as Lang;
  const earned = MEDALS.filter((m) => progress.medals.includes(m.id)).length;
  return (
    <Modal open={open} title={`${t.learn.medals} · ${earned} ${t.learn.of} ${MEDALS.length}`} onClose={onClose}>
      <ul className="grid max-h-[55vh] gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
        {MEDALS.map((medal) => {
          const has = progress.medals.includes(medal.id);
          return (
            <li key={medal.id} className={`bevel-inset flex items-start gap-3 p-2 ${has ? "" : "opacity-60"}`}>
              <PixelSprite icon={has ? medal.icon : "lock"} scale={3} className="shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="font-pixel text-lg text-amber">{medal.name[lang]}</span>
                <span className="text-base text-steel-200">{medal.how[lang]}</span>
                {suitForMedal(medal.id) && (
                  <span className="flex items-center gap-2 text-base text-lime">
                    <PixelSprite sprite="astronaut" anim="idle" scale={1} swap={suitForMedal(medal.id)!.swap} paused />
                    {t.learn.reward}: {suitForMedal(medal.id)!.name[lang]}
                  </span>
                )}
                {!has && <Badge tone="info">{t.learn.lockedMedal}</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="font-tiny mt-3 text-xs text-steel-400">{t.learn.cosmeticNote}</p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Entrenador: tutorial jugable. Resalta una zona y espera a que el    */
/* niño haga la acción de verdad; nunca bloquea los controles.         */
/* ------------------------------------------------------------------ */

/** Zona del HUD que resalta cada paso y si el paso espera una acción del jugador. */
export const COACH_STEPS: { target: string | null; wait: boolean }[] = [
  { target: "resources", wait: false },
  { target: "base", wait: true },
  { target: "commands", wait: true },
  { target: "advance", wait: true },
  { target: "crew", wait: false },
  { target: null, wait: false },
];

type CoachProps = { step: number; hidden: boolean; onNext: () => void; onSkip: () => void };

export function Coach({ step, hidden, onNext, onSkip }: CoachProps) {
  const { t } = useI18n();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const next = useAutoFocus<HTMLButtonElement>(`${step}-${hidden}`);
  const { target, wait } = COACH_STEPS[step];
  const last = step === COACH_STEPS.length - 1;

  useLayoutEffect(() => {
    if (hidden || !target) {
      setRect(null);
      return;
    }
    // Puede haber dos objetivos (escritorio y dock móvil): se usa el visible.
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].find((n) => n.getClientRects().length > 0);
    const update = () => setRect(el?.getBoundingClientRect() ?? null);
    el?.scrollIntoView({ block: "nearest" });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target, hidden, step]);

  if (hidden) return null;
  const pad = 6;
  const boxAtTop = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;

  return (
    // pointer-events-none: el niño puede tocar el juego a través del entrenador.
    <div className="pointer-events-none fixed inset-0 z-50" role="region" aria-label={t.coach.title}>
      {rect && (
        <div
          aria-hidden
          className={`absolute ${wait ? "blink" : ""}`}
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            // En los pasos de "hazlo tú" el fondo se oscurece menos para que se vea todo el juego.
            boxShadow: `0 0 0 9999px rgb(10 14 22 / ${wait ? 0.45 : 0.78})`,
            outline: "calc(var(--px) * 2) solid var(--color-neon-cyan)",
          }}
        />
      )}
      <div className={`pointer-events-auto absolute inset-x-0 mx-auto w-[min(94vw,640px)] ${boxAtTop ? "top-4" : "bottom-28 lg:bottom-4"}`}>
        <RobotCard tag={`${t.coach.title} · ${step + 1}/${COACH_STEPS.length}`} tone="var(--color-neon-cyan)" talking>
          <p className="text-xl" aria-live="polite">
            {t.coach.steps[step]}
          </p>
          {wait && <p className="font-tiny text-xs text-amber uppercase">▶ {t.coach.waiting}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {!last && (
              <PixelButton variant="ghost" onClick={onSkip}>
                {t.coach.skip}
              </PixelButton>
            )}
            {!wait && (
              <PixelButton ref={next} variant="primary" onClick={onNext}>
                {last ? t.coach.finish : t.coach.next}
              </PixelButton>
            )}
          </div>
        </RobotCard>
      </div>
    </div>
  );
}
