"use client";

import { useState } from "react";
import { PixelSprite } from "./PixelSprite";
import { PixelButton } from "./PixelButton";
import { useI18n } from "@/lib/providers";

export type MinimapModule = { id: string; label: string; x: number; y: number; w: number; h: number; alert?: boolean };
export type MinimapCrew = { id: string; x: number; y: number; color: string };

type Props = {
  modules: MinimapModule[];
  crew: MinimapCrew[];
  /** tamaño lógico del mapa (en "píxeles" del minimapa) */
  width?: number;
  height?: number;
};

/** Vista reducida de la base. En pantallas pequeñas se colapsa en un botón. */
export function Minimap({ modules, crew, width = 64, height = 40 }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const alerted = modules.filter((m) => m.alert);

  const map = (
    <figure className="bevel-inset inline-block p-1">
      <svg
        className="pixel block"
        width={width * 3}
        height={height * 3}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`${t.minimap.label}. ${alerted.map((m) => `⚠ ${m.label}`).join(", ")}`}
      >
        <rect width={width} height={height} fill="var(--color-steel-950)" />
        {/* superficie */}
        <rect y={0} width={width} height={6} fill="var(--color-sky)" />
        <rect y={6} width={width} height={2} fill="var(--color-regolith)" />
        {modules.map((m) => (
          <g key={m.id} className={m.alert ? "blink" : undefined}>
            <rect
              x={m.x}
              y={m.y}
              width={m.w}
              height={m.h}
              fill={m.alert ? "var(--color-alert)" : "var(--color-steel-700)"}
              stroke={m.alert ? "var(--color-amber)" : "var(--color-steel-400)"}
              strokeWidth={0.5}
            />
          </g>
        ))}
        {crew.map((c) => (
          <rect key={c.id} x={c.x} y={c.y} width={2} height={2} fill={c.color} />
        ))}
      </svg>
      {alerted.length > 0 && (
        <figcaption className="font-tiny mt-1 text-xs text-alert uppercase">⚠ {alerted.map((m) => m.label).join(", ")}</figcaption>
      )}
    </figure>
  );

  return (
    <>
      <div className="hidden md:block">{map}</div>
      <div className="md:hidden">
        <PixelButton aria-expanded={open} onClick={() => setOpen((o) => !o)} icon={<span aria-hidden>▦</span>}>
          {t.minimap.open}
        </PixelButton>
        {open && <div className="mt-2">{map}</div>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Indicador de clima espacial                                         */
/* ------------------------------------------------------------------ */

export type SpaceWeatherLevel = "calm" | "active" | "storm";

const LEVEL_INFO: Record<SpaceWeatherLevel, { bars: number; color: string }> = {
  calm: { bars: 1, color: "var(--color-lime)" },
  active: { bars: 2, color: "var(--color-amber)" },
  storm: { bars: 3, color: "var(--color-alert)" },
};

export function SpaceWeather({ level }: { level: SpaceWeatherLevel }) {
  const { t } = useI18n();
  const info = LEVEL_INFO[level];
  const text = t.spaceWeather[level];
  return (
    <div className="flex items-center gap-2" role="status" aria-label={`${t.spaceWeather.label}: ${text}`}>
      <PixelSprite icon="sun" scale={2} className={level === "storm" ? "blink" : undefined} />
      <div className="flex flex-col leading-none">
        <span className="font-tiny text-xs text-steel-200 uppercase">{t.spaceWeather.label}</span>
        <span className="font-pixel text-lg" style={{ color: info.color }}>
          {text}
        </span>
      </div>
      <div className="flex items-end gap-[var(--px)]" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span
            key={b}
            className="w-2"
            style={{ height: 6 + b * 5, background: b <= info.bars ? info.color : "var(--color-steel-700)" }}
          />
        ))}
      </div>
    </div>
  );
}
