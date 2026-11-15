"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertBanner,
  Badge,
  CommandCard,
  DialogBox,
  Minimap,
  Modal,
  PixelButton,
  PixelSprite,
  ResourceCounter,
  SettingsBar,
  SpaceWeather,
  UnitPanel,
  type Command,
  type UnitStat,
} from "@/components/hud";
import type { MissionView, PreviewResult } from "@/lib/orbita/schema";
import { useAudio, useI18n } from "@/lib/providers";
import { BaseScene } from "./BaseScene";
import { EndModal, SourcesModal } from "./GameModals";
import { COACH_STEPS, Coach, LogbookModal, MedalCard, MedalsModal, PreviewPanel, QuizCard, TermCard } from "./LearningCards";
import { suitColor, useCrewLook } from "./wardrobe";
import { MEDALS, newMedals, pickLesson, triggersFor, useProgress, type Medal, type Quiz, type Term } from "./learning";
import {
  actionText,
  commandLayout,
  eventText,
  isMars,
  moduleText,
  CREW,
  DANGER,
  crewAnim,
  crewPlacement,
  deriveModules,
  isAlarm,
  localizeAlert,
  spaceWeather,
  activityFor,
  type Activity,
  type ModuleId,
  type TurnPayload,
} from "./model";
import { missionErrorText, reviewText } from "./reviewText";
import { TurnReport } from "./TurnReport";
import { isDemo, type ActionId, type MissionController, type ScenarioParams } from "./useMission";

/** Cola de cosas que R0-B1 muestra una por una, en orden. */
type Narration =
  | { kind: "text"; text: string }
  | { kind: "report"; turn: number; payload: TurnPayload }
  | { kind: "term"; term: Term }
  | { kind: "quiz"; quiz: Quiz }
  | { kind: "medal"; medal: Medal };

const COST_UNITS: Record<string, [string, number]> = {
  energy_kwh: ["kWh", 1],
  oxygen_kg: ["kg O₂", 2],
  water_l: ["L", 1],
  food_kg: ["kg", 1],
  spare_parts: ["⚙", 0],
};

function formatCosts(costs: Record<string, number>) {
  return Object.entries(costs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const [unit, d] = COST_UNITS[k] ?? [k, 1];
      return `−${v.toFixed(d)} ${unit}`;
    })
    .join(" · ");
}

type Props = { game: MissionController & { mission: MissionView } };

export function MissionHud({ game }: Props) {
  const { t, locale } = useI18n();
  const { play } = useAudio();
  const copy = reviewText(locale);
  const { mission, log, latest, busy, scenario } = game;
  const s = mission.state;
  const p: ScenarioParams = scenario?.parameters ?? {
    turns: 12,
    actions_per_turn: 2,
    energy_capacity_kwh: 50,
    oxygen_capacity_kg: 6,
    water_capacity_l: 30,
    food_capacity_kg: 6,
    science_target: 24,
  };

  const modules = useMemo(() => deriveModules(mission), [mission]);
  const weather = spaceWeather(mission, log);
  const actionsLeft = Math.max(0, p.actions_per_turn - s.actions_used);
  const active = s.status === "active";

  const [vitalsExpanded, setVitalsExpanded] = useState(false);
  const [selected, setSelected] = useState<ModuleId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logbookOpen, setLogbookOpen] = useState(false);
  const [medalsOpen, setMedalsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const { progress, ready, learn, answer, award, finishTutorial } = useProgress();
  const { look } = useCrewLook();
  /** Paso del tutorial jugable; null = no está activo. */
  const [coachStep, setCoachStep] = useState<number | null>(null);
  /** Acción elegida que espera confirmación en "¿Qué pasaría si…?". */
  const [pendingAction, setPendingAction] = useState<{ id: ActionId; result: PreviewResult | "error" | null } | null>(null);
  const mars = isMars(mission);

  /* ---------- Reacción a los eventos de la última orden ---------- */
  // Cola: mensajes de R0-B1 e informes de turno, en el orden en que los emitió el backend.
  const [queue, setQueue] = useState<Narration[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [deltas, setDeltas] = useState<{ key: number; values: Record<string, number> } | null>(null);
  const [turnBanner, setTurnBanner] = useState<{ key: number; text: string } | null>(null);

  const processed = useRef<unknown>(null);
  useEffect(() => {
    // Espera a que cargue el progreso guardado para no repetir palabras ya aprendidas.
    if (!ready || !latest.length || processed.current === latest) return;
    processed.current = latest;
    const key = Date.now();
    const items: Narration[] = [];
    let report: Narration | null = null;
    for (const e of latest) {
      if (e.type === "action_applied") {
        const id = e.payload.action_id as ActionId;
        setActivity(activityFor(id, key));
        setDeltas({ key, values: (e.payload.resource_delta ?? {}) as Record<string, number> });
      } else if (e.type === "turn_advanced") {
        const payload = e.payload as unknown as TurnPayload;
        setDeltas({ key, values: payload.resource_delta });
        setTurnBanner({ key, text: `${t.game.turn} ${e.turn}` });
        report = { kind: "report", turn: e.turn, payload };
      } else {
        const text = eventText(t, mission, e.type);
        if (text) items.push({ kind: "text", text });
      }
    }
    // Lección del momento: como mucho una palabra nueva y una pregunta por orden.
    const lesson = pickLesson(triggersFor(latest, s.scenario_id), progress);
    if (lesson.term) {
      learn(lesson.term.id);
      items.push({ kind: "term", term: lesson.term });
    }
    if (lesson.quiz) items.push({ kind: "quiz", quiz: lesson.quiz });
    // Orden: incidentes, palabra, pregunta y, al final, el informe que cierra el turno.
    if (report) items.push(report);
    if (items.length) setQueue((q) => [...q, ...items]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, ready]);

  /* ---------- Medallas: se revisan con cada cambio confirmado ---------- */
  useEffect(() => {
    if (!ready) return;
    const fresh = newMedals({ mission, log, evaluation: game.evaluation, progress });
    if (!fresh.length) return;
    award(fresh.map((m) => m.id));
    setQueue((q) => [...q, ...fresh.map((medal) => ({ kind: "medal" as const, medal }))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mission, log, game.evaluation, progress.terms.length, progress.quizzes]);

  // La animación de la acción dura ~3 s y luego el astronauta vuelve a su módulo.
  useEffect(() => {
    if (!activity) return;
    const id = window.setTimeout(() => setActivity(null), 4500);
    return () => window.clearTimeout(id);
  }, [activity]);
  useEffect(() => {
    if (!turnBanner) return;
    const id = window.setTimeout(() => setTurnBanner(null), 1500);
    return () => window.clearTimeout(id);
  }, [turnBanner]);

  const nextNarration = useCallback(() => {
    setQueue((q) => {
      // Tutorial: el paso "avanza el tiempo" termina cuando el niño cierra su primer informe.
      if (q[0]?.kind === "report") setCoachStep((step) => (step === 3 ? 4 : step));
      return q.slice(1);
    });
  }, []);
  const delta = (k: string) => (deltas && deltas.values[k] !== undefined ? { value: deltas.values[k], key: deltas.key } : null);

  /* ---------- Banner sólo para alertas NUEVAS ---------- */
  const prevAlerts = useRef<string[]>(mission.alerts);
  const [banner, setBanner] = useState<string | null>(null);
  useEffect(() => {
    const fresh = mission.alerts.find((a) => !prevAlerts.current.includes(a));
    prevAlerts.current = mission.alerts;
    if (fresh) setBanner(fresh);
    // Una alerta resuelta (fuga reparada, paneles limpios) retira su aviso.
    else setBanner((current) => (current && !mission.alerts.includes(current) ? null : current));
  }, [mission.alerts]);

  /* ---------- Tutorial jugable (la primera vez, al empezar una misión) ---------- */
  const coachStarted = useRef(false);
  useEffect(() => {
    if (!ready || coachStarted.current) return;
    coachStarted.current = true;
    if (!progress.tutorialDone && s.turn === 0 && s.actions_used === 0 && active) setCoachStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  // Los pasos de "hazlo tú" avanzan solos cuando el juego confirma lo que hizo el niño.
  useEffect(() => {
    if (coachStep === 1 && selected) setCoachStep(2);
    else if (coachStep === 2 && (s.actions_used > 0 || s.turn > 0)) setCoachStep(3);
  }, [coachStep, selected, s.actions_used, s.turn]);
  const skipCoach = useCallback(() => {
    setCoachStep(null);
    finishTutorial();
  }, [finishTutorial]);
  const nextCoach = useCallback(() => {
    if (coachStep === null) return;
    if (coachStep < COACH_STEPS.length - 1) {
      setCoachStep(coachStep + 1);
      return;
    }
    setCoachStep(null);
    finishTutorial();
    // La medalla de graduación sólo se gana terminando, no saltando el tutorial.
    const medal = MEDALS.find((m) => m.id === "graduate");
    if (medal && !progress.medals.includes(medal.id)) {
      award([medal.id]);
      setQueue((q) => [...q, { kind: "medal", medal }]);
    }
  }, [award, coachStep, finishTutorial, progress.medals]);
  const coachInfo = coachStep !== null && !COACH_STEPS[coachStep].wait;
  /** Mientras R0-B1 explica un paso, lo demás espera; en los pasos de práctica se ve todo. */
  const showQueue = queue.length > 0 && !coachInfo;
  // La lista móvil es el propio control de acciones; sólo bloquea los controles de fondo.
  const commandsBlocked = showQueue || !!pendingAction || menuOpen || sourcesOpen || medalsOpen || logbookOpen || coachInfo;
  const overlayOpen = commandsBlocked || actionsOpen;

  /* ---------- "¿Qué pasaría si…?" ---------- */
  const askPreview = useCallback(
    (id: ActionId) => {
      setPendingAction({ id, result: null });
      const request = game.preview(id);
      if (!request) return;
      request
        .then((result) => setPendingAction((current) => (current?.id === id ? { id, result } : current)))
        .catch(() => setPendingAction((current) => (current?.id === id ? { id, result: "error" } : current)));
    },
    [game],
  );
  const confirmAction = useCallback(() => {
    if (!pendingAction?.result || pendingAction.result === "error" || !pendingAction.result.forecast) return;
    const { id } = pendingAction;
    setPendingAction(null);
    void game.act(id);
  }, [game, pendingAction]);

  /* ---------- Espacio = avanzar turno ---------- */
  const canAdvance = active && !busy && !game.hasPending && !overlayOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || overlayOpen) return;
      const el = e.target as HTMLElement;
      if (el.closest("button, input, textarea, select, dialog[open]")) return;
      e.preventDefault();
      if (canAdvance) void game.advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAdvance, game, overlayOpen]);

  /* ---------- Tarjeta de comandos ---------- */
  const commands: Command[] = commandLayout(mission).map(({ id, icon }) => {
    const opt = mission.available_actions.find((a) => a.id === id);
    const enabled = !!opt?.enabled && actionsLeft > 0 && active && !busy && !game.hasPending && !commandsBlocked;
    const reason = !opt?.enabled
      ? locale === "es"
        ? (opt?.disabled_reason ?? t.game.unavailable)
        : t.game.unavailable
      : actionsLeft === 0
        ? t.game.noActionsLeft
        : null;
    const costs = opt ? formatCosts(opt.costs) : "";
    return {
      id,
      icon,
      label: actionText(t, mission, id).label,
      hint: [actionText(t, mission, id).hint, costs && `${t.game.cost}: ${costs}`, reason && `✖ ${reason}`].filter(Boolean).join("\n"),
      locked: !enabled,
      onActivate: () => askPreview(id),
    };
  });

  /* ---------- Panel central: módulo seleccionado o tripulación ---------- */
  const health = Math.round(s.crew_health_pct);
  const exposure = Math.round(s.exposure_risk_index * 10) / 10;
  const crewStats: UnitStat[] = [
    { label: t.game.health, value: health },
    { label: t.game.exposure, value: exposure, color: "var(--color-orange)", inverse: true },
    { label: t.game.science, value: s.science_points, max: p.science_target, color: "var(--color-neon-cyan)" },
  ];
  const r = s.resources;
  const pct = (v: number, max: number) => Math.round((v / max) * 100);
  const moduleStats: Record<ModuleId, UnitStat[]> = {
    solar: [{ label: t.game.integrity, value: s.systems.solar_integrity_pct, color: "var(--color-amber)" }],
    habitat: [{ label: t.resources.energy, value: pct(r.energy_kwh, p.energy_capacity_kwh), color: "var(--color-amber)" }],
    oxygen: [{ label: t.resources.oxygen, value: pct(r.oxygen_kg, p.oxygen_capacity_kg), color: "var(--color-neon-cyan)" }],
    water: [{ label: t.game.water, value: pct(r.water_l, p.water_capacity_l), color: "var(--color-neon-cyan)" }],
    greenhouse: [{ label: t.game.food, value: pct(r.food_kg, p.food_capacity_kg) }],
    shelter: [{ label: t.game.exposure, value: exposure, color: "var(--color-orange)", inverse: true }],
  };
  const sel = selected ? modules.find((m) => m.id === selected) : null;

  const minimapModules = modules.map((m) => ({
    id: m.id,
    label: moduleText(t, mission, m.id).name,
    alert: isAlarm(m.status),
    ...m.map,
  }));
  const placement = crewPlacement(mission);
  const crewDots = CREW.map((c, i) => {
    const mm = modules.find((m) => m.id === placement[i])!.map;
    const color = suitColor(look[i]);
    return { id: c.id, x: mm.x + 3 + (i % 2) * 5 + (placement[i] === "shelter" ? i * 4 : 0), y: mm.y + 6, color };
  });

  const hour = String(s.elapsed_hours).padStart(2, "0");

  return (
    <div data-testid="mission-hud" data-mission-id={s.id} data-turn={s.turn} data-version={s.version} className="flex min-h-dvh flex-col gap-2 p-2 pb-24 md:p-3 lg:pb-3">
      {/* ================= BARRA SUPERIOR ================= */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <PixelButton disabled={showQueue || !!pendingAction || coachInfo} className="whitespace-nowrap" onClick={() => setMenuOpen(true)} aria-haspopup="dialog">
            ☰ {t.game.menu}
          </PixelButton>
          <div className="bevel flex items-center gap-3 px-3 py-1" role="status" aria-label={`${t.game.turn} ${s.turn} / ${p.turns}`}>
            <PixelSprite icon="day" scale={2} />
            <div className="flex flex-col leading-none">
              <span className="font-tiny text-xs text-steel-200 uppercase">{t.game.turn}</span>
              <span className="font-pixel text-2xl tabular-nums">
                {s.turn}
                <span className="text-base text-steel-400">/{p.turns}</span>
              </span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-tiny text-xs text-steel-200 uppercase">{t.game.hour}</span>
              <span className="font-pixel text-2xl tabular-nums">{hour}:00</span>
            </div>
          </div>
          <Badge tone="info">{mars ? t.destination.mars : t.destination.moon}</Badge>
          {s.rules_version.endsWith("1.0.0") && <Badge tone="warn">{locale === "en" ? "Previous rules · saved mission" : "Reglas anteriores · partida guardada"}</Badge>}
          {isDemo() ? <Badge tone="warn">DEMO</Badge> : <Badge tone="info">{copy.historical}{mars ? " · 20-05-2024" : ""}</Badge>}
          {s.status === "paused" && <Badge tone="warn">{t.missionStatus.paused}</Badge>}
        </div>
        <div className="bevel flex min-w-0 max-w-full flex-wrap gap-1 px-1 py-1" data-tour="resources">
          <ResourceCounter icon="energy" label={t.resources.energy} value={r.energy_kwh} unit="kWh" decimals={1} max={p.energy_capacity_kwh} dangerBelow={DANGER.energy_kwh} delta={delta("energy_kwh")} />
          <PixelButton className="md:hidden" aria-expanded={vitalsExpanded} onClick={() => setVitalsExpanded(v => !v)}>{copy.support} · {vitalsExpanded ? copy.hide : copy.details}</PixelButton>
          <div className={vitalsExpanded || mission.alerts.length > 0 ? "contents" : "hidden md:contents"}>
          <ResourceCounter
            icon="oxygen"
            label={t.resources.oxygen}
            value={r.oxygen_kg}
            unit="kg"
            decimals={2}
            max={p.oxygen_capacity_kg}
            dangerBelow={DANGER.oxygen_kg}
            delta={delta("oxygen_kg")}
            sub={`${t.game.reserve}: ${r.reserve_oxygen_kg.toFixed(1)}`}
          />
          <ResourceCounter
            icon="food"
            label={t.game.water}
            value={r.water_l}
            unit="L"
            decimals={1}
            max={p.water_capacity_l}
            dangerBelow={DANGER.water_l}
            delta={delta("water_l")}
            sub={`${t.game.reserve}: ${r.reserve_water_l.toFixed(1)}`}
          />
          <ResourceCounter icon="ration" label={t.game.food} value={r.food_kg} unit="kg" decimals={2} max={p.food_capacity_kg} dangerBelow={DANGER.food_kg} delta={delta("food_kg")} />
          <ResourceCounter icon="gear" label={t.game.parts} value={r.spare_parts} delta={delta("spare_parts")} />
          </div>
        </div>
      </header>

      {mission.planning && <aside className="bevel-inset flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-base" aria-label={copy.support}>
        <span>{copy.foodHours}: <strong>{mission.planning.food_autonomy_hours.toFixed(1)} h</strong> · {copy.hours}</span>
        <span className={r.food_kg < mission.planning.food_reserve_target_kg ? "text-amber" : "text-lime"}>{copy.foodTarget}: {mission.planning.food_reserve_target_kg.toFixed(1)} kg</span>
        {mars && <span>{copy.data}: {s.unreported_data_points}</span>}
        {mission.planning.pending_reply_minutes !== null && <span className="text-amber">{copy.pendingRadio}: {mission.planning.pending_reply_minutes} {copy.minutes}</span>}
        <details className="w-full"><summary className="cursor-pointer py-2">{copy.simulation} · {s.practice_mode === "training" ? copy.training : copy.historicalMode}</summary><p>{copy.harvestNote} {mars && copy.radioNote}</p></details>
      </aside>}
      {banner && <AlertBanner icon="warning" message={localizeAlert(banner, locale)} onDismiss={() => setBanner(null)} />}
      {game.error && (
        <div role="alert" className="bevel flex items-center gap-3 px-3 py-2" style={{ ["--bevel-fill" as string]: "var(--color-alert-dark)" }}>
          <span className="flex-1">{missionErrorText(game.error, locale, game.errorCode)}</span>
          {game.canRetry && <PixelButton disabled={busy || game.retryIn > 0} onClick={() => void game.retry()}>{t.menu.retry}{game.retryIn > 0 ? ` (${game.retryIn}s)` : ""}</PixelButton>}
        </div>
      )}

      {/* ================= ESCENA ================= */}
      <main className="flex-1" data-tour="base">
        <BaseScene
          mission={mission}
          modules={modules}
          weather={weather}
          selected={selected}
          onSelect={id => { if (!overlayOpen) setSelected(id); }}
          activity={activity}
          turnBanner={turnBanner}
        />
      </main>

      {/* ================= CONSOLA INFERIOR ================= */}
      <footer className="bevel rivets grid gap-3 p-3 lg:grid-cols-[auto_1fr_auto]">
        {/* Izquierda: minimapa + clima */}
        <section className="flex flex-col gap-2" aria-label={t.minimap.label}>
          <Minimap modules={minimapModules} crew={crewDots} />
          <SpaceWeather level={weather} />
        </section>

        {/* Centro: selección */}
        <section className="min-w-0" data-tour="crew" aria-live="polite">
          {sel ? (
            <div className="flex flex-col gap-2">
              <UnitPanel
                name={moduleText(t, mission, sel.id).name}
                description={moduleText(t, mission, sel.id).desc}
                icon={sel.icon}
                sprite={sel.sprite?.name}
                anim={sel.sprite?.anim}
                stats={moduleStats[sel.id]}
              />
              <PixelButton variant="ghost" className="self-start" onClick={() => setSelected(null)}>
                ← {t.game.crew}
              </PixelButton>
            </div>
          ) : (
            <UnitPanel
              name={t.game.crew}
              description={`${t.game.selectHint} ${t.game.exposureNote}`}
              sprite="astronaut"
              anim={crewAnim(mission)}
              stats={crewStats}
              badges={
                <>
                  {s.systems.crew_in_shelter && <Badge tone="info">{t.game.inShelter}</Badge>}
                  {mission.alerts.map((a) => (
                    <Badge key={a} tone="warn">
                      {localizeAlert(a, locale)}
                    </Badge>
                  ))}
                </>
              }
            />
          )}
        </section>

        {/* Derecha: comandos + avanzar */}
        <section className="hidden flex-col items-center gap-2 lg:flex">
          <div data-tour="commands" className="flex flex-col items-center gap-1">
            <span className="font-tiny flex items-center gap-1 text-xs text-steel-200 uppercase" aria-label={`${t.game.actionsLeft}: ${actionsLeft}`}>
              {t.game.actionsLeft}
              {Array.from({ length: p.actions_per_turn }, (_, i) => (
                <span key={i} aria-hidden className="inline-block h-3 w-3" style={{ background: i < actionsLeft ? "var(--color-lime)" : "var(--color-steel-700)" }} />
              ))}
            </span>
            <CommandCard commands={commands} hotkeys={!overlayOpen} />
          </div>
          <PixelButton
            data-tour="advance"
            variant="primary"
            className="w-full"
            disabled={!canAdvance}
            onClick={() => {
              play("success");
              void game.advance();
            }}
            title={t.game.advanceHint}
            aria-keyshortcuts="Space"
            icon={<PixelSprite icon="next" scale={2} />}
          >
            {busy ? "…" : t.game.advance}
          </PixelButton>
          <span className="font-tiny text-xs text-steel-400">[{t.game.advanceKey}]</span>
        </section>
      </footer>

      {/* ================= DOCK MÓVIL (comandos siempre a mano) ================= */}
      <nav
        aria-label={t.game.actionsLeft}
        data-testid="mobile-dock"
        className="bevel fixed inset-x-0 bottom-0 z-30 flex gap-2 p-2 lg:hidden"
        style={{ ["--bevel-fill" as string]: "var(--color-steel-900)" }}
      >
        <PixelButton
          data-tour="commands"
          className="min-w-0 flex-1 flex-wrap px-2 sm:px-4"
          disabled={!active || busy || game.hasPending || overlayOpen}
          onClick={() => setActionsOpen(true)}
          aria-haspopup="dialog"
          icon={<span className="hidden sm:inline-flex"><PixelSprite icon="explore" scale={2} /></span>}
        >
          {t.game.actionsLeft}
          <span aria-hidden className="flex gap-1">
            {Array.from({ length: p.actions_per_turn }, (_, i) => (
              <span key={i} className="inline-block h-3 w-3" style={{ background: i < actionsLeft ? "var(--color-lime)" : "var(--color-steel-700)" }} />
            ))}
          </span>
        </PixelButton>
        <PixelButton
          data-tour="advance"
          variant="primary"
          className="min-w-0 flex-1 flex-wrap px-2 sm:px-4"
          disabled={!canAdvance}
          onClick={() => {
            play("success");
            void game.advance();
          }}
          icon={<span className="hidden sm:inline-flex"><PixelSprite icon="next" scale={2} /></span>}
        >
          {busy ? "…" : t.game.advance}
        </PixelButton>
      </nav>

      <Modal open={actionsOpen} title={`${t.game.actionsLeft} · ${actionsLeft}/${p.actions_per_turn}`} onClose={() => setActionsOpen(false)}>
        <ul className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto pr-1">
          {commands.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={c.locked}
                onClick={() => {
                  setActionsOpen(false);
                  c.onActivate?.();
                }}
                className="bevel pixel-btn flex w-full items-start gap-3 p-3 text-left"
              >
                <PixelSprite icon={c.locked ? "lock" : c.icon} scale={2} />
                <span className="flex flex-col">
                  <span className="font-pixel text-lg text-neon-cyan">{c.label}</span>
                  <span className="whitespace-pre-line text-lg text-steel-200">{c.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* ================= NARRACIÓN (una cosa a la vez) ================= */}
      {showQueue && queue[0].kind === "text" && (
        <div data-testid="narration" className="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-2xl">
          <DialogBox modal key={queue[0].text + queue.length} speaker={t.assistant.name} text={queue[0].text} onConfirm={nextNarration} />
        </div>
      )}
      {showQueue && queue[0].kind === "term" && (
        <div data-testid="narration" className="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-2xl">
          <TermCard key={queue[0].term.id} term={queue[0].term} onClose={nextNarration} />
        </div>
      )}
      {showQueue && queue[0].kind === "quiz" && (
        <div data-testid="narration" className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-void/60 p-2">
          <div className="w-full max-w-2xl">
            <QuizCard key={queue[0].quiz.id} quiz={queue[0].quiz} onAnswer={(correct) => answer((queue[0] as { quiz: Quiz }).quiz.id, correct)} onClose={nextNarration} />
          </div>
        </div>
      )}
      {showQueue && queue[0].kind === "medal" && (
        <div data-testid="narration" className="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-2xl">
          <MedalCard key={queue[0].medal.id} medal={queue[0].medal} onClose={nextNarration} />
        </div>
      )}
      {showQueue && queue[0].kind === "report" && (
        <div data-testid="narration" className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-void/60 p-2">
          <div className="w-full max-w-3xl">
            <TurnReport
              key={queue[0].turn}
              turn={queue[0].turn}
              payload={queue[0].payload}
              params={p}
              systemsOn={{ habitat: true, oxygen: s.systems.oxygen_generator_on, water: true, greenhouse: s.systems.greenhouse_on }}
              storm={!mars && log.some((e) => e.type === "solar_incident" && e.turn === (queue[0] as { turn: number }).turn)}
              moduleName={(id) => moduleText(t, mission, id).name}
              onClose={nextNarration}
            />
          </div>
        </div>
      )}

      {/* ================= ¿QUÉ PASARÍA SI…? ================= */}
      {pendingAction && !showQueue && (
        <div className="fixed inset-0 z-40 grid place-items-end overflow-y-auto bg-void/50 p-2 sm:place-items-center">
          <div className="w-full max-w-xl">
            <PreviewPanel
              label={actionText(t, mission, pendingAction.id).label}
              hint={actionText(t, mission, pendingAction.id).hint}
              icon={commandLayout(mission).find((c) => c.id === pendingAction.id)?.icon ?? "explore"}
              result={pendingAction.result}
              current={{ resources: r as unknown as Record<string, number>, science_points: s.science_points, exposure_risk_index: s.exposure_risk_index }}
              names={{
                energy_kwh: t.resources.energy,
                oxygen_kg: t.resources.oxygen,
                water_l: t.game.water,
                food_kg: t.game.food,
                spare_parts: t.game.parts,
                reserve_oxygen_kg: `${t.game.reserve} O₂`,
                reserve_water_l: `${t.game.reserve} ${t.game.water}`,
              }}
              note={pendingAction.id === "contact_earth" ? t.preview.replyLater : null}
              busy={busy || game.hasPending}
              onConfirm={confirmAction}
              onCancel={() => setPendingAction(null)}
              onRetry={() => askPreview(pendingAction.id)}
            />
          </div>
        </div>
      )}

      {/* ================= MODALES ================= */}
      <Modal open={menuOpen} title={t.game.menu} onClose={() => setMenuOpen(false)}>
        <div className="flex flex-col gap-2">
          <PixelButton onClick={() => { setMenuOpen(false); setCoachStep(0); }}>{t.game.tutorial}</PixelButton>
          <PixelButton icon={<PixelSprite icon="book" scale={2} />} onClick={() => { setMenuOpen(false); setLogbookOpen(true); }}>
            {t.learn.logbook} · {progress.terms.length}
          </PixelButton>
          <PixelButton icon={<PixelSprite icon="medal" scale={2} />} onClick={() => { setMenuOpen(false); setMedalsOpen(true); }}>
            {t.learn.medals} · {progress.medals.length}
          </PixelButton>
          <PixelButton onClick={() => { setMenuOpen(false); setSourcesOpen(true); }}>{t.game.sources}</PixelButton>
          <SettingsBar />
          {(active || s.status === "paused") && (
            <PixelButton disabled={busy || game.hasPending} onClick={() => { setMenuOpen(false); void (active ? game.pause() : game.resume()); }}>
              {active ? t.game.pause : t.game.resume}
            </PixelButton>
          )}
          <PixelButton disabled={busy || game.hasPending} variant="ghost" onClick={() => { setMenuOpen(false); game.exitToMenu(); }}>{t.game.exit}</PixelButton>
          {(active || s.status === "paused") && (
            <PixelButton disabled={busy || game.hasPending} variant="danger" onClick={() => { setMenuOpen(false); void game.abort(); }}>{t.game.abort}</PixelButton>
          )}
        </div>
      </Modal>
      <LogbookModal open={logbookOpen} onClose={() => setLogbookOpen(false)} progress={progress} />
      <MedalsModal open={medalsOpen} onClose={() => setMedalsOpen(false)} progress={progress} />
      <SourcesModal scenarioId={s.scenario_id} key={s.id} open={sourcesOpen} onClose={() => setSourcesOpen(false)} load={game.science} />
      <EndModal actionName={id => actionText(t, mission, id).label} evaluation={queue.length ? null : game.evaluation} onAgain={() => void game.restart()} onMenu={game.exitToMenu}
        busy={busy} hasPending={game.hasPending} error={game.error ? missionErrorText(game.error, locale, game.errorCode) : null} retryIn={game.retryIn} onRetry={game.canRetry ? () => void game.retry() : undefined} />
      {coachStep !== null && (
        <Coach step={coachStep} hidden={(showQueue || !!pendingAction || menuOpen) && !coachInfo} onNext={nextCoach} onSkip={skipCoach} />
      )}
    </div>
  );
}

