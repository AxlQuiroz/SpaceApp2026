"use client";

import { PixelSprite } from "./PixelSprite";
import { useSteppedNumber } from "@/lib/hooks";
import type { IconName } from "@/sprites/sprites.config";
import { useI18n } from "@/lib/providers";

/* ------------------------------------------------------------------ */
/* Barra segmentada (salud / ánimo / energía)                          */
/* ------------------------------------------------------------------ */

type StatBarProps = {
  label: string;
  value: number; // 0..100
  color?: string;
  segments?: number;
  /** valor máximo (por defecto 100) */
  max?: number;
  /** si true, valores ALTOS son malos (p.ej. exposición) */
  inverse?: boolean;
};

export function StatBar({ label, value, color = "var(--color-lime)", segments = 10, max = 100, inverse = false }: StatBarProps) {
  const v = Math.round(Math.max(0, Math.min(max, value)) * 10) / 10;
  const filled = Math.round((v / max) * segments);
  const low = inverse ? v / max >= 0.6 : v / max <= 0.25;
  return (
    // En pantallas estrechas la etiqueta va en su propia línea para que la barra no se aplaste.
    <div className="flex flex-wrap items-center gap-x-2">
      <span className="font-tiny w-full shrink-0 text-sm text-steel-200 uppercase sm:w-28">{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={v}
        className="bevel-inset flex flex-1 gap-[var(--px)] p-[var(--px)]"
      >
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 ${i < filled && low ? "blink" : ""}`}
            style={{ background: i < filled ? (low ? "var(--color-alert)" : color) : "var(--color-steel-900)" }}
          />
        ))}
      </div>
      <span className="font-pixel w-10 text-right text-base tabular-nums">{v}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contador de recurso (barra superior)                                */
/* ------------------------------------------------------------------ */

type ResourceProps = {
  icon: IconName;
  label: string;
  value: number;
  /** sufijo, p.ej. "%" */
  unit?: string;
  /** umbral bajo el cual parpadea en rojo; omitir para no alertar */
  dangerBelow?: number;
  /** capacidad: dibuja una mini barra de llenado */
  max?: number;
  decimals?: number;
  /** texto extra pequeño, p.ej. la reserva */
  sub?: string;
  /** cambio reciente: se muestra flotando (+0.4 / −2). Cambia `key` para repetir la animación. */
  delta?: { value: number; key: number } | null;
};

export function ResourceCounter({ icon, label, value, unit = "", dangerBelow, max, decimals = 0, sub, delta }: ResourceProps) {
  const { t } = useI18n();
  const shown = useSteppedNumber(value, 6, 50, decimals);
  const danger = dangerBelow !== undefined && value < dangerBelow;
  const pct = max ? Math.max(0, Math.min(1, value / max)) : null;
  const spoken = `${label}: ${value.toFixed(decimals)} ${unit}${max ? ` / ${max}` : ""}${sub ? `. ${sub}` : ""}${
    danger ? `. ${t.resources.danger}` : ""
  }`;
  return (
    <div className={`relative flex min-h-[44px] items-center gap-2 px-2 ${danger ? "alert-flash" : ""}`} aria-label={spoken} role="group">
      {delta && Math.abs(delta.value) >= 10 ** -decimals / 2 && (
        <span
          key={delta.key}
          aria-hidden
          className="float-up font-pixel pointer-events-none absolute top-5 right-1 z-10 text-lg"
          style={{
            color: delta.value > 0 ? "var(--color-lime)" : "var(--color-alert)",
            textShadow: "var(--px) var(--px) 0 var(--color-void)",
          }}
        >
          {delta.value > 0 ? "+" : "−"}
          {Math.abs(delta.value).toFixed(decimals)}
        </span>
      )}
      <PixelSprite icon={icon} scale={2} />
      <div className="flex flex-col leading-none" aria-hidden>
        <span className="font-tiny text-xs text-steel-200 uppercase">{label}</span>
        <span className={`font-pixel text-2xl tabular-nums ${danger ? "text-alert" : "text-steel-50"}`}>
          {shown}
          <span className="ml-0.5 text-sm text-steel-400">{unit}</span>
          {danger && <span className="ml-1 text-base">!</span>}
        </span>
        {pct !== null && (
          <span className="mt-0.5 flex h-[calc(var(--px)*2)] w-16 bg-steel-950">
            <span
              style={{
                width: `${Math.round(pct * 8) * 12.5}%`, // 8 pasos: sin interpolación suave
                background: danger ? "var(--color-alert)" : "var(--color-neon-cyan)",
              }}
            />
          </span>
        )}
        {sub && <span className="font-tiny mt-0.5 text-xs text-steel-400">{sub}</span>}
      </div>
    </div>
  );
}
