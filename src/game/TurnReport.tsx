"use client";

import { useEffect, useRef } from "react";
import { PixelButton, PixelSprite } from "@/components/hud";
import type { IconName } from "@/sprites/sprites.config";
import { useI18n } from "@/lib/providers";
import { useFocusTrap } from "@/lib/hooks";
import type { TurnPayload } from "./model";
import type { ScenarioParams } from "./useMission";

const RESOURCES: { key: "energy_kwh" | "oxygen_kg" | "water_l" | "food_kg"; icon: IconName; unit: string; d: number; cap: keyof ScenarioParams }[] = [
  { key: "energy_kwh", icon: "energy", unit: "kWh", d: 1, cap: "energy_capacity_kwh" },
  { key: "oxygen_kg", icon: "oxygen", unit: "kg", d: 2, cap: "oxygen_capacity_kg" },
  { key: "water_l", icon: "food", unit: "L", d: 1, cap: "water_capacity_l" },
  { key: "food_kg", icon: "ration", unit: "kg", d: 2, cap: "food_capacity_kg" },
];

const SYSTEMS = ["habitat", "oxygen", "water", "greenhouse"] as const;

type Props = {
  turn: number;
  payload: TurnPayload;
  params: ScenarioParams;
  /** estado de encendido de los sistemas (para distinguir "apagado" de "sin energía") */
  systemsOn: Record<(typeof SYSTEMS)[number], boolean>;
  storm: boolean;
  /** nombre visible de cada módulo (cambia entre la Luna y Marte) */
  moduleName?: (id: (typeof SYSTEMS)[number]) => string;
  onClose: () => void;
};

/**
 * Explica qué pasó en las 2 horas simuladas: producción solar, a qué módulos llegó la energía,
 * cuánto subió o bajó cada recurso y una pista para el siguiente turno.
 * Todos los números vienen del evento `turn_advanced` del backend.
 */
export function TurnReport({ turn, payload, params, systemsOn, storm, moduleName, onClose }: Props) {
  const { t } = useI18n();
  const trap = useFocusTrap<HTMLElement>();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus({ preventScroll: true }), []);

  // Pista: el recurso que más cayó en proporción a su capacidad.
  const worst = RESOURCES.map((r) => ({ key: r.key, rel: (payload.resource_delta[r.key] ?? 0) / Number(params[r.cap]) })).sort(
    (a, b) => a.rel - b.rel,
  )[0];
  // Lo más urgente primero: salud, radiación y, después, el recurso que más bajó.
  const tip =
    payload.health_loss_points >= 1 && (payload.power_fractions.habitat ?? 1) < 1
      ? t.report.tips.habitat
      : payload.risk_delta_points >= 5
        ? t.report.tips.exposure
        : worst && worst.rel < -0.02
          ? t.report.tips[worst.key]
          : t.report.tips.ok;

  return (
    <section
      ref={trap}
      role="dialog"
      aria-modal="true"
      className="bevel rivets pop-in flex flex-col gap-3"
      style={{ padding: "calc(var(--px) * 5)" }}
      aria-labelledby="turn-report-title"
    >
      <header className="flex items-center justify-between gap-2 bg-steel-900 px-3 py-1">
        <h2 id="turn-report-title" className="font-pixel text-xl text-neon-cyan uppercase">
          {t.report.title} · {t.game.turn} {turn}
        </h2>
        <PixelSprite sprite="robot" anim="idle" scale={2} />
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Sol → energía */}
        <div className="bevel-inset flex flex-col gap-2 p-3">
          <p className="flex items-center gap-2 text-xl">
            <PixelSprite icon="sun" scale={2} />
            {t.report.sun} <strong className="font-pixel text-amber">{payload.generated_kwh.toFixed(1)} kWh</strong>
          </p>
          {storm && <p className="text-lg text-orange">▲ {t.report.stormCut}</p>}
          {payload.sky_factor !== undefined && payload.sky_factor < 1 && <p className="text-lg text-orange">▲ {t.report.dustCut}</p>}
          <h3 className="font-tiny text-xs text-steel-400 uppercase">{t.report.power}</h3>
          <ul className="flex flex-col gap-1">
            {SYSTEMS.map((s) => {
              const f = payload.power_fractions[s] ?? 0;
              const on = systemsOn[s];
              const label = !on ? t.report.off : f >= 0.999 ? t.report.full : f > 0 ? t.report.partial : t.report.none;
              const color = !on ? "var(--color-steel-400)" : f >= 0.999 ? "var(--color-lime)" : f > 0 ? "var(--color-amber)" : "var(--color-alert)";
              return (
                <li key={s} className="flex items-center gap-2 text-lg">
                  <span className="w-36 truncate">{moduleName ? moduleName(s) : t.modules[s].name}</span>
                  <span className="flex h-3 flex-1 bg-steel-950" aria-hidden>
                    <span style={{ width: `${on ? Math.round(f * 100) : 0}%`, background: color }} />
                  </span>
                  <span className="font-tiny w-20 text-right text-xs uppercase" style={{ color }}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Cambios de recursos */}
        <div className="bevel-inset flex flex-col gap-2 p-3">
          <h3 className="font-tiny text-xs text-steel-400 uppercase">{t.report.changes}</h3>
          <ul className="flex flex-col gap-1">
            {RESOURCES.map((r) => {
              const v = payload.resource_delta[r.key] ?? 0;
              const up = v > 0;
              const zero = Math.abs(v) < 10 ** -r.d / 2;
              return (
                <li key={r.key} className="flex items-center gap-2 text-xl">
                  <PixelSprite icon={r.icon} scale={2} />
                  <span className="flex-1">{r.key === "energy_kwh" ? t.resources.energy : r.key === "oxygen_kg" ? t.resources.oxygen : r.key === "water_l" ? t.game.water : t.game.food}</span>
                  <span
                    className="font-pixel tabular-nums"
                    style={{ color: zero ? "var(--color-steel-400)" : up ? "var(--color-lime)" : "var(--color-alert)" }}
                  >
                    {zero ? "=" : up ? "▲ +" : "▼ −"}
                    {zero ? "" : Math.abs(v).toFixed(r.d)} {zero ? "" : r.unit}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="flex items-center gap-2 text-lg">
            <PixelSprite icon="heart" scale={2} />
            {payload.health_loss_points > 0 ? (
              <span className="text-alert">
                {t.report.healthLoss}: −{payload.health_loss_points.toFixed(0)}
              </span>
            ) : (
              <span className="text-lime">{t.report.healthOk}</span>
            )}
          </p>
          <p className="flex items-center gap-2 text-lg">
            <PixelSprite icon="warning" scale={2} />
            {t.report.exposure}: +{payload.risk_delta_points.toFixed(1)}
          </p>
        </div>
      </div>

      {payload.dose_rate_ugy_h !== undefined && (
        <p className="bevel-inset flex flex-wrap items-center gap-2 p-3 text-lg">
          <span className="font-tiny bg-neon-cyan px-2 py-0.5 text-xs text-void uppercase">{t.report.realData}</span>
          <PixelSprite icon="flask" scale={2} />
          <span>
            {t.report.radReading} <strong className="font-pixel text-amber">{payload.dose_rate_ugy_h.toFixed(1)}</strong> {t.report.radUnit}.
          </span>
        </p>
      )}

      <p className="bevel-inset flex items-start gap-2 p-3 text-lg text-steel-50">
        <span className="font-pixel text-amber">★ {t.report.tip}:</span>
        <span>{tip}</span>
      </p>

      <div className="flex justify-end">
        <PixelButton ref={btn} variant="primary" onClick={onClose} icon={<PixelSprite icon="next" scale={2} />}>
          {t.report.continue}
        </PixelButton>
      </div>
    </section>
  );
}

