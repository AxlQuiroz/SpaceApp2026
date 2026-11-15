"use client";

import type { ReactNode } from "react";
import { Badge, PixelSprite, Starfield } from "@/components/hud";
import type { SpaceWeatherLevel } from "@/components/hud";
import type { MissionView } from "@/lib/orbita/schema";
import { useI18n } from "@/lib/providers";
import { suitSwap, useCrewLook } from "./wardrobe";
import { CREW, crewAnim, crewPlacement, isMars, moduleText, type Activity, type BaseModule, type ModuleId, type ModuleStatus } from "./model";

type Props = {
  mission: MissionView;
  modules: BaseModule[];
  weather: SpaceWeatherLevel;
  selected: ModuleId | null;
  onSelect: (id: ModuleId) => void;
  /** animación de la última acción (se limpia sola) */
  activity: Activity | null;
  /** cartel "TURNO N" (cambia la key para reiniciar la animación) */
  turnBanner: { key: number; text: string } | null;
};

type RoomProps = {
  m: BaseModule;
  crew: { id: string; swap: Record<string, string> }[];
  anim: string;
  selected: boolean;
  name: string;
  label: string;
  badge: ReactNode;
  onSelect: (id: ModuleId) => void;
  flicker: boolean;
  className?: string;
};

function Room({ m, crew, anim, selected, name, label, badge, onSelect, flicker, className = "" }: RoomProps) {
  const alarm = m.status === "damaged" || m.status === "leak";
  return (
    <button
      type="button"
      onClick={() => onSelect(m.id)}
      aria-pressed={selected}
      aria-label={label}
      className={`bevel pixel-btn relative flex min-h-24 flex-col items-stretch p-2 text-left md:min-h-24 ${
        alarm ? "alert-flash" : ""
      } ${className}`}
      style={{
        ["--bevel-fill" as string]: m.status === "off" ? "var(--color-steel-900)" : "var(--color-steel-800)",
        outline: selected ? "var(--px) solid var(--color-amber)" : undefined,
      }}
    >
      <span className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-tiny text-xs text-steel-200 uppercase">{name}</span>
        {badge}
      </span>
      <span
        className={`bevel-inset mt-1 flex flex-1 items-end justify-center gap-1 px-2 pt-2 ${flicker ? "flicker" : ""}`}
        // pared del módulo: rejilla pixelada muy tenue
        style={{
          backgroundImage:
            "linear-gradient(var(--color-steel-900) var(--px), transparent var(--px)), linear-gradient(90deg, var(--color-steel-900) var(--px), transparent var(--px))",
          backgroundSize: "calc(var(--px) * 12) calc(var(--px) * 12)",
          backgroundColor: m.status === "off" ? "var(--color-void)" : "var(--color-steel-950)",
        }}
      >
        {m.sprite ? (
          <PixelSprite sprite={m.sprite.name} anim={m.sprite.anim} scale={3} />
        ) : (
          <PixelSprite icon={m.icon} scale={3} className={m.status === "off" ? "opacity-40" : undefined} />
        )}
        {crew.map((c) => (
          <PixelSprite key={c.id} sprite="astronaut" anim={anim} scale={2} swap={c.swap} />
        ))}
      </span>
    </button>
  );
}

/** Partículas de la tormenta solar (posiciones fijas, sin azar en cada render). */
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 23) % 60}%`,
  delay: `${(i % 6) * 0.2}s`,
}));

/** Base lunar en corte transversal: superficie arriba, módulos bajo tierra. */
export function BaseScene({ mission, modules, weather, selected, onSelect, activity, turnBanner }: Props) {
  const { t } = useI18n();
  const byId = Object.fromEntries(modules.map((m) => [m.id, m])) as Record<ModuleId, BaseModule>;
  const placement = crewPlacement(mission);
  // Trajes del vestidor: solo apariencia, no cambian la simulación.
  const { look } = useCrewLook();
  const crew = CREW.map((c, i) => ({ id: c.id, swap: suitSwap(look[i]) }));
  const baseAnim = crewAnim(mission);
  const solar = byId.solar;
  const mars = isMars(mission);
  const dust = mission.state.systems.dust_storm_active;
  const name = (id: ModuleId) => moduleText(t, mission, id).name;
  // Colores del terreno según el planeta.
  const ground = mars ? "bg-mars" : "bg-regolith";
  const groundDark = mars ? "bg-mars-dark" : "bg-regolith-dark";

  // El explorador o el reparador de paneles "sale" de su módulo mientras dura la animación.
  const awayIndex = activity?.explorer || activity?.surfaceWorker ? 0 : -1;

  const statusText = (st: ModuleStatus) =>
    ({ ok: t.game.ok, off: t.game.off, damaged: mars ? t.game.dusty : t.game.damaged, leak: t.game.leak, occupied: t.game.inShelter })[st];
  const statusBadge = (s: ModuleStatus) => {
    const tone = ({ ok: "ok", off: "warn", damaged: "bad", leak: "bad", occupied: "info" } as const)[s];
    return <Badge tone={tone}>{statusText(s)}</Badge>;
  };

  const room = (id: ModuleId, className?: string) => (
    <Room
      m={byId[id]}
      crew={crew.filter((_, i) => placement[i] === id && i !== awayIndex)}
      anim={activity?.workRoom === id ? "work" : baseAnim}
      selected={selected === id}
      name={name(id)}
      label={`${name(id)}: ${statusText(byId[id].status)}`}
      badge={statusBadge(byId[id].status)}
      onSelect={onSelect}
      flicker={activity?.flicker === id}
      className={className}
    />
  );

  return (
    <div className="relative flex h-full flex-col gap-[calc(var(--px)*2)]">
      {/* ---------- Superficie: cielo + regolito + paneles ---------- */}
      <button
        type="button"
        onClick={() => onSelect("solar")}
        aria-pressed={selected === "solar"}
        aria-label={`${name("solar")}: ${mission.state.systems.solar_integrity_pct}%${dust ? `. ${t.game.dustStorm}` : ""}`}
        className="bevel-inset pixel-btn relative h-28 overflow-hidden md:h-32 lg:h-28"
        style={{ outline: selected === "solar" ? "var(--px) solid var(--color-amber)" : undefined }}
      >
        <Starfield className="absolute inset-0" />
        {/* Marte: cielo anaranjado por el polvo en suspensión; más denso durante la tormenta. */}
        {mars && <div aria-hidden className="absolute inset-0" style={{ background: dust ? "rgb(122 47 26 / 0.85)" : "rgb(194 86 47 / 0.35)" }} />}
        {dust &&
          PARTICLES.map((p, i) => (
            <span
              key={`d${i}`}
              aria-hidden
              className="dust-particle absolute h-[calc(var(--px)*2)] w-[calc(var(--px)*4)] bg-mars"
              style={{ top: `${(i * 29) % 90}%`, animationDelay: p.delay }}
            />
          ))}
        {weather !== "calm" && (
          <div
            aria-hidden
            className={`absolute inset-0 ${weather === "storm" ? "blink" : ""}`}
            style={{ background: weather === "storm" ? "rgb(242 122 42 / 0.35)" : "rgb(255 178 62 / 0.15)" }}
          />
        )}
        {weather === "storm" &&
          PARTICLES.map((p, i) => (
            <span
              key={i}
              aria-hidden
              className="storm-particle absolute h-[calc(var(--px)*2)] w-[calc(var(--px)*2)] bg-amber"
              style={{ left: p.left, top: p.top, animationDelay: p.delay }}
            />
          ))}
        {/* Rótulo: dónde estamos (los niños confundían la escena con una nave o con la Tierra). */}
        <span className="font-tiny absolute top-2 left-3 bg-void/70 px-2 py-0.5 text-xs text-neon-cyan uppercase">
          {mars ? t.game.surfaceMars : t.game.surfaceMoon}
        </span>
        <div className={`absolute top-2 right-3 ${dust ? "opacity-30" : ""}`}>
          <PixelSprite icon="sun" scale={weather === "storm" ? 4 : 3} className={weather === "storm" ? "blink" : undefined} />
        </div>

        {/* suelo con cráteres */}
        <div className={`absolute inset-x-0 bottom-0 h-8 ${ground}`} />
        <div className={`absolute bottom-5 left-[40%] h-1 w-6 ${groundDark}`} />
        <div className={`absolute bottom-3 left-[78%] h-1 w-10 ${groundDark}`} />
        <div className={`absolute inset-x-0 bottom-0 h-2 ${groundDark}`} />
        {/* Antena de comunicaciones (Marte) con ondas al llamar a la Tierra */}
        {mars && (
          <div className="absolute right-[14%] bottom-6 flex items-end">
            <PixelSprite icon="antenna" scale={3} />
            {activity?.radio && <span key={activity.key} aria-hidden className="font-pixel blink -ml-2 mb-6 text-2xl text-neon-cyan">)))</span>}
          </div>
        )}

        <div className="absolute bottom-6 left-3 flex items-end gap-1 md:gap-2">
          {[0, 1, 2].map((i) => (
            <PixelSprite key={i} sprite="solarPanel" anim={solar.status === "damaged" ? "damaged" : "normal"} scale={3} />
          ))}
          {activity?.surfaceWorker && (
            <PixelSprite key={activity.key} sprite="astronaut" anim="work" scale={2} swap={crew[0].swap} />
          )}
        </div>

        {activity?.explorer && (
          <div key={activity.key} className="walk-across absolute bottom-6">
            <PixelSprite sprite="astronaut" anim="explore" scale={2} swap={crew[0].swap} />
          </div>
        )}

        <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
          <span className="font-tiny hidden text-xs text-void uppercase sm:inline">{name("solar")}</span>
          {statusBadge(solar.status)}
          {dust && <Badge tone="bad">{t.game.dustStorm}</Badge>}
          <span className="font-pixel text-base text-void">{mission.state.systems.solar_integrity_pct}%</span>
        </div>
      </button>

      {/* ---------- Subsuelo: módulos ---------- */}
      <div className={`grid flex-1 grid-cols-2 gap-[calc(var(--px)*2)] ${groundDark} p-[calc(var(--px)*2)] md:grid-cols-6`}>
        <p className="col-span-full flex flex-wrap items-baseline gap-x-2 px-1 leading-tight">
          <span className="font-tiny text-xs text-amber uppercase">▼ {t.game.underground}</span>
          <span className="text-xs text-steel-200">{t.game.undergroundWhy}</span>
        </p>
        {room("habitat", "md:col-span-2")}
        {room("oxygen", "md:col-span-2")}
        {room("water", "col-span-2 md:col-span-2")}
        {room("greenhouse", "md:col-span-3")}
        {room("shelter", "md:col-span-3")}
      </div>

      {/* ---------- Cartel de turno ---------- */}
      {turnBanner && (
        <div key={turnBanner.key} aria-hidden className="turn-banner pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center">
          <span
            className="bevel font-pixel px-8 py-2 text-4xl text-amber uppercase md:text-5xl"
            style={{ ["--bevel-fill" as string]: "var(--color-steel-950)" }}
          >
            {turnBanner.text}
          </span>
        </div>
      )}
    </div>
  );
}
