"use client";

import { useEffect, useId, useState } from "react";
import { PixelSprite } from "./PixelSprite";
import type { IconName } from "@/sprites/sprites.config";
import { useAudio, useI18n } from "@/lib/providers";

/** Teclas fijas por posición de la cuadrícula 3x3. */
export const HOTKEYS = ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"] as const;

export type CommandTone = "good" | "on" | "off" | "warn" | "muted";

export type Command = {
  id: string;
  icon: IconName;
  label: string;
  /** explicación corta para niños */
  hint?: string;
  locked?: boolean;
  /** etiqueta visible con el efecto ("+ ciencia", "Encender"…) */
  tag?: { text: string; tone: CommandTone };
  /** por qué está bloqueada, en lenguaje sencillo */
  reason?: string | null;
  /** qué gasta ("Gasta: 2 kWh energía") */
  cost?: string;
  /** R0-B1 la recomienda ahora */
  suggested?: boolean;
  onActivate?: () => void;
};

type Props = {
  /** hasta 9 posiciones; `null` = hueco vacío */
  commands: (Command | null)[];
  /** escuchar teclas globales Q..C */
  hotkeys?: boolean;
  /** sugerencia de R0-B1 que se muestra cuando no hay ninguna acción señalada */
  suggestion?: { label: string; why: string } | null;
};

export const TONE_COLOR: Record<CommandTone, string> = {
  good: "var(--color-lime)",
  on: "var(--color-lime)",
  off: "var(--color-amber)",
  warn: "var(--color-orange)",
  muted: "var(--color-steel-400)",
};

/**
 * Tarjeta de comandos 3x3 pensada para niñas y niños de 7 a 12 años:
 * cada botón muestra icono + nombre + una etiqueta con su efecto, y debajo
 * hay un panel fijo que explica la acción señalada (sustituye al tooltip,
 * que se salía de la pantalla y no funcionaba con el dedo).
 */
export function CommandCard({ commands, hotkeys = true, suggestion }: Props) {
  const { t } = useI18n();
  const { play } = useAudio();
  const baseId = useId();
  const [pressed, setPressed] = useState<number | null>(null);
  /** acción señalada con el ratón, el teclado o un toque en una bloqueada */
  const [info, setInfo] = useState<number | null>(null);
  const slots = Array.from({ length: 9 }, (_, i) => commands[i] ?? null);

  const trigger = (i: number) => {
    const c = slots[i];
    if (!c) return;
    if (c.locked) {
      // En pantallas táctiles no hay "hover": tocar una bloqueada explica por qué.
      setInfo(i);
      play("error");
      return;
    }
    play("click");
    setPressed(i);
    window.setTimeout(() => setPressed(null), 120);
    c.onActivate?.();
  };

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
      const i = HOTKEYS.indexOf(e.key.toUpperCase() as (typeof HOTKEYS)[number]);
      if (i >= 0) trigger(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const shown = info !== null ? slots[info] : null;

  return (
    <div className="flex w-[23.5rem] max-w-full flex-col gap-2">
      <div role="toolbar" aria-label={t.commands.title} className="grid grid-cols-3 gap-[calc(var(--px)*2)]" onMouseLeave={() => setInfo(null)}>
        {slots.map((c, i) => {
          const key = HOTKEYS[i];
          if (!c) return <span key={i} className="bevel-inset min-h-[5.5rem]" aria-hidden />;
          const descId = `${baseId}-${i}`;
          return (
            <button
              key={c.id}
              type="button"
              data-command={c.id}
              data-suggested={c.suggested || undefined}
              aria-label={c.locked ? `${c.label} (${t.commands.locked})` : c.label}
              aria-describedby={descId}
              aria-keyshortcuts={key}
              aria-disabled={c.locked || undefined}
              data-pressed={pressed === i}
              onClick={() => trigger(i)}
              onMouseEnter={() => setInfo(i)}
              onFocus={() => setInfo(i)}
              onBlur={() => setInfo((v) => (v === i ? null : v))}
              className={`bevel pixel-btn relative flex min-h-[5.5rem] flex-col items-center justify-start gap-1 px-1 pt-2 pb-1 text-center ${
                c.locked ? "cursor-not-allowed" : ""
              }`}
              style={
                c.suggested && !c.locked
                  ? { ["--bevel-light" as string]: "var(--color-amber)", outline: "var(--px) solid var(--color-amber)", outlineOffset: "var(--px)" }
                  : c.locked
                    ? { ["--bevel-fill" as string]: "var(--color-steel-900)" }
                    : undefined
              }
            >
              <span className={c.locked ? "opacity-40 grayscale" : c.suggested ? "glow" : ""}>
                <PixelSprite icon={c.icon} scale={2} />
              </span>
              {c.locked && (
                <span className="absolute top-1 left-1" aria-hidden>
                  <PixelSprite icon="lock" scale={1} />
                </span>
              )}
              {c.suggested && !c.locked && (
                <span className="font-tiny absolute top-0.5 left-1 text-sm text-amber" aria-hidden>
                  ★
                </span>
              )}
              <span className="font-tiny absolute top-0.5 right-1 text-xs text-amber" aria-hidden>
                {key}
              </span>
              <span className={`font-pixel text-base leading-tight ${c.locked ? "text-steel-400" : "text-steel-50"}`}>{c.label}</span>
              {c.tag && (
                <span className="font-tiny mt-auto text-sm uppercase" style={{ color: c.locked ? TONE_COLOR.muted : TONE_COLOR[c.tag.tone] }}>
                  {c.tag.text}
                </span>
              )}
              <span id={descId} className="sr-only">
                {[c.hint, c.cost, c.locked && c.reason ? `${t.commands.whyNot} ${c.reason}` : null].filter(Boolean).join(". ")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel de ayuda: siempre visible, mismo ancho que la cuadrícula. */}
      <div className="bevel-inset min-h-[6.5rem] px-3 py-2 text-lg leading-snug" data-testid="command-help">
        {shown ? (
          // Los lectores de pantalla ya lo reciben por aria-describedby de cada botón.
          <div aria-hidden>
            <p className="font-pixel flex items-center gap-2 text-base text-neon-cyan">
              <PixelSprite icon={shown.icon} scale={1} />
              {shown.label}
            </p>
            {shown.hint && <p className="text-steel-50">{shown.hint}</p>}
            {shown.locked ? (
              <p className="text-amber">✖ {shown.reason ?? t.commands.locked}</p>
            ) : (
              shown.cost && <p className="text-steel-200">{shown.cost}</p>
            )}
          </div>
        ) : suggestion ? (
          <>
            <p className="font-pixel text-base text-amber">★ {t.commands.suggested}: {suggestion.label}</p>
            <p className="text-steel-50">{suggestion.why}</p>
          </>
        ) : (
          <p className="text-steel-200">{t.commands.idleHelp}</p>
        )}
      </div>
    </div>
  );
}
