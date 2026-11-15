"use client";

import type { ReactNode } from "react";
import { PixelSprite } from "./PixelSprite";
import { StatBar } from "./Bars";
import type { IconName, SpriteName } from "@/sprites/sprites.config";

type PortraitProps = { sprite: SpriteName; anim: string; label: string; size?: number; swap?: Record<string, string> };

/** Retrato animado dentro de un marco hundido tipo monitor. */
export function Portrait({ sprite, anim, label, size = 5, swap }: PortraitProps) {
  return (
    <div className="bevel-inset scanlines inline-flex shrink-0 items-center justify-center p-2">
      <PixelSprite sprite={sprite} anim={anim} scale={size} label={label} swap={swap} />
    </div>
  );
}

export type UnitStat = { label: string; value: number; color?: string; max?: number; inverse?: boolean };

type UnitPanelProps = {
  name: string;
  description: string;
  stats: UnitStat[];
  /** retrato: sprite animado o icono */
  sprite?: SpriteName;
  anim?: string;
  icon?: IconName;
  swap?: Record<string, string>;
  /** etiquetas de estado (icono + texto) */
  badges?: ReactNode;
};

/** Sección central del panel inferior: unidad/módulo seleccionado. */
export function UnitPanel({ name, description, stats, sprite, anim = "idle", icon, swap, badges }: UnitPanelProps) {
  return (
    <div className="flex items-start gap-3">
      {sprite ? (
        <Portrait sprite={sprite} anim={anim} label={name} swap={swap} />
      ) : (
        <div className="bevel-inset scanlines inline-flex shrink-0 p-2">
          <PixelSprite icon={icon ?? "warning"} scale={5} label={name} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-pixel text-xl text-neon-cyan">{name}</h3>
        {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
        {stats.map((s) => (
          <StatBar key={s.label} {...s} />
        ))}
        <p className="mt-1 text-lg text-steel-200">{description}</p>
      </div>
    </div>
  );
}

/** Etiqueta de estado: siempre icono/símbolo + texto, nunca solo color. */
export function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "info"; children: ReactNode }) {
  const color = {
    ok: "var(--color-lime)",
    warn: "var(--color-amber)",
    bad: "var(--color-alert)",
    info: "var(--color-neon-cyan)",
  }[tone];
  const symbol = { ok: "●", warn: "▲", bad: "✖", info: "◆" }[tone];
  return (
    <span className="font-tiny bevel-inset inline-flex items-center gap-1 px-2 py-0.5 text-xs uppercase" style={{ color }}>
      <span aria-hidden>{symbol}</span>
      {children}
    </span>
  );
}
