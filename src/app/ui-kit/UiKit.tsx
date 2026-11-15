"use client";

import { useState, type ReactNode } from "react";
import {
  AlertBanner,
  CommandCard,
  DialogBox,
  Minimap,
  Modal,
  Panel,
  PixelButton,
  PixelSprite,
  Portrait,
  ResourceCounter,
  SettingsBar,
  SpaceWeather,
  StatBar,
  Starfield,
  Tooltip,
  UnitPanel,
  type Command,
  type SpaceWeatherLevel,
} from "@/components/hud";
import { ICONS, SPRITES, type IconName, type SpriteName } from "@/sprites/sprites.config";
import { useAudio, useI18n } from "@/lib/providers";

const PALETTE = [
  "void", "steel-950", "steel-900", "steel-800", "steel-700", "steel-600", "steel-400", "steel-200", "steel-50",
  "neon-cyan", "cyan-dark", "lime", "lime-dark", "amber", "orange", "alert", "alert-dark",
  "regolith", "regolith-dark", "mars", "mars-dark", "sky", "star", "skin",
];

const MODULES = [
  { id: "hab", label: "Hábitat", x: 4, y: 10, w: 18, h: 10 },
  { id: "green", label: "Invernadero", x: 24, y: 10, w: 18, h: 10 },
  { id: "power", label: "Energía", x: 44, y: 10, w: 16, h: 10 },
  { id: "lab", label: "Laboratorio", x: 4, y: 24, w: 26, h: 10 },
  { id: "shelter", label: "Refugio", x: 32, y: 24, w: 28, h: 10 },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title} className="w-full">
      <div className="flex flex-wrap items-start gap-4 p-2">{children}</div>
    </Panel>
  );
}

export function UiKit() {
  const { t } = useI18n();
  const { play } = useAudio();
  const [oxygen, setOxygen] = useState(78);
  const [modalOpen, setModalOpen] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [weather, setWeather] = useState<SpaceWeatherLevel>("calm");
  const [lastCmd, setLastCmd] = useState<string>("—");

  const commands: (Command | null)[] = [
    { id: "repair", icon: "repair", label: t.commands.repair, onActivate: () => setLastCmd(t.commands.repair) },
    { id: "farm", icon: "farm", label: t.commands.farm, onActivate: () => setLastCmd(t.commands.farm) },
    { id: "solar", icon: "solar", label: t.commands.solar, onActivate: () => setLastCmd(t.commands.solar) },
    { id: "rest", icon: "rest", label: t.commands.rest, onActivate: () => setLastCmd(t.commands.rest) },
    { id: "scan", icon: "sun", label: t.commands.scan, locked: true },
    null,
    null,
    null,
    null,
  ];

  return (
    <div className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10">
        <Starfield />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-pixel text-4xl text-neon-cyan">{t.uiKit.title}</h1>
          <SettingsBar />
        </header>

        {alertOn && (
          <div className="sticky top-2 z-20">
            <AlertBanner icon="sun" message={t.alerts.solarStorm} onDismiss={() => setAlertOn(false)} />
          </div>
        )}

        {/* ---------- Vista previa del HUD completo ---------- */}
        <Section title="HUD">
          <div className="flex w-full flex-col gap-2">
            <div className="flex justify-end">
              <div className="bevel flex flex-wrap gap-1 px-2 py-1">
                <ResourceCounter icon="oxygen" label={t.resources.oxygen} value={oxygen} unit="%" dangerBelow={30} />
                <ResourceCounter icon="food" label={t.resources.food} value={64} unit="%" dangerBelow={30} />
                <ResourceCounter icon="energy" label={t.resources.energy} value={91} unit="%" dangerBelow={30} />
                <ResourceCounter icon="day" label={t.resources.day} value={3} />
              </div>
            </div>
            <div className="bevel-inset relative grid h-40 place-items-center overflow-hidden">
              <Starfield className="absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 h-10 bg-regolith" />
              <div className="relative flex items-end gap-2 pt-12">
                <PixelSprite sprite="astronaut" anim="walk" scale={3} />
                <PixelSprite sprite="greenhouse" anim="normal" scale={4} />
                <PixelSprite sprite="astronaut" anim="work" scale={3} />
              </div>
            </div>
            <div className="bevel rivets grid gap-3 p-4 md:grid-cols-[auto_1fr_auto]">
              <div className="flex flex-col gap-2">
                <Minimap modules={MODULES.map((m) => ({ ...m, alert: m.id === "green" && oxygen < 30 }))} crew={[{ id: "a", x: 10, y: 15, color: "#9be43a" }, { id: "b", x: 30, y: 15, color: "#3ee6f0" }]} />
                <SpaceWeather level={weather} />
              </div>
              <UnitPanel
                sprite="astronaut"
                anim="idle"
                name={t.units.nova.name}
                description={t.units.nova.desc}
                stats={[
                  { label: t.stats.health, value: 86 },
                  { label: t.stats.mood, value: 62, color: "var(--color-amber)" },
                  { label: t.stats.energy, value: 45, color: "var(--color-neon-cyan)" },
                ]}
              />
              <div className="flex flex-col items-center gap-2">
                <CommandCard commands={commands} />
                <span className="font-tiny text-xs text-steel-400">▶ {lastCmd}</span>
              </div>
            </div>
          </div>
        </Section>

        <Section title={t.uiKit.palette}>
          <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {PALETTE.map((c) => (
              <div key={c} className="bevel-inset flex flex-col p-1">
                <span className="h-10" style={{ background: `var(--color-${c})` }} />
                <span className="font-tiny mt-1 text-xs text-steel-200">{c}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t.uiKit.typography}>
          <div className="flex flex-col gap-2">
            <p className="font-pixel text-4xl">Pixelify Sans — 0123456789</p>
            <p className="font-tiny text-xl uppercase">Silkscreen — HUD labels</p>
            <p className="text-2xl">VT323 — {t.uiKit.sample}</p>
          </div>
        </Section>

        <Section title={t.uiKit.panels}>
          <Panel title="Panel" className="w-64">
            <p className="text-lg">Bisel + remaches</p>
          </Panel>
          <Panel className="w-64" inset scanlines>
            <p className="text-lg">Hundido + scanlines</p>
          </Panel>
        </Section>

        <Section title={t.uiKit.buttons}>
          <PixelButton>Default</PixelButton>
          <PixelButton variant="primary" icon={<PixelSprite icon="farm" scale={2} />}>
            {t.commands.farm}
          </PixelButton>
          <PixelButton variant="danger">Danger</PixelButton>
          <PixelButton variant="ghost">Ghost</PixelButton>
          <PixelButton disabled>Disabled</PixelButton>
        </Section>

        <Section title={t.uiKit.bars}>
          <div className="flex w-full max-w-md flex-col gap-2">
            <StatBar label={t.stats.health} value={90} />
            <StatBar label={t.stats.mood} value={55} color="var(--color-amber)" />
            <StatBar label={t.stats.energy} value={20} color="var(--color-neon-cyan)" />
          </div>
        </Section>

        <Section title={t.uiKit.resources}>
          <ResourceCounter icon="oxygen" label={t.resources.oxygen} value={oxygen} unit="%" dangerBelow={30} />
          <PixelButton onClick={() => setOxygen((o) => Math.max(0, o - 15))}>O₂ −15</PixelButton>
          <PixelButton onClick={() => setOxygen((o) => Math.min(100, o + 15))}>O₂ +15</PixelButton>
        </Section>

        <Section title={t.uiKit.portraits}>
          {(Object.keys(SPRITES) as SpriteName[]).flatMap((s) =>
            Object.keys(SPRITES[s]).map((a) => (
              <figure key={`${s}-${a}`} className="flex flex-col items-center gap-1">
                <Portrait sprite={s} anim={a} label={`${s} ${a}`} size={4} />
                <figcaption className="font-tiny text-xs text-steel-200">
                  {s}/{a}
                </figcaption>
              </figure>
            )),
          )}
          <div className="flex w-full flex-wrap gap-3">
            {(Object.keys(ICONS) as IconName[]).map((i) => (
              <figure key={i} className="bevel-inset flex flex-col items-center p-2">
                <PixelSprite icon={i} scale={3} label={i} />
                <figcaption className="font-tiny text-xs text-steel-200">{i}</figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section title={t.uiKit.commandCard}>
          <CommandCard commands={commands} hotkeys={false} />
          <p className="max-w-xs text-lg text-steel-200">Q W E / A S D / Z X C — ▶ {lastCmd}</p>
        </Section>

        <Section title={t.uiKit.tooltip}>
          <Tooltip content={t.units.greenhouse.desc}>
            {(id) => (
              <PixelButton aria-describedby={id} icon={<PixelSprite icon="farm" scale={2} />}>
                {t.units.greenhouse.name}
              </PixelButton>
            )}
          </Tooltip>
        </Section>

        <Section title={t.uiKit.alert}>
          <PixelButton variant="danger" onClick={() => setAlertOn(true)}>
            {t.uiKit.triggerAlert}
          </PixelButton>
          <div className="w-full">
            <AlertBanner icon="oxygen" message={t.alerts.oxygenFail} />
          </div>
        </Section>

        <Section title={t.uiKit.dialog}>
          <div className="w-full max-w-2xl">
            <DialogBox
              key={`${dialogKey}-${t.assistant.intro}`}
              speaker={t.assistant.name}
              text={t.assistant.intro}
              onConfirm={() => {
                play("success");
                setDialogKey((k) => k + 1);
              }}
            />
          </div>
        </Section>

        <Section title={t.uiKit.modal}>
          <PixelButton variant="primary" onClick={() => setModalOpen(true)}>
            {t.uiKit.openModal}
          </PixelButton>
          <Modal open={modalOpen} title={t.uiKit.modalTitle} onClose={() => setModalOpen(false)}>
            <div className="flex gap-4">
              <PixelSprite icon="sun" scale={4} />
              <p>{t.uiKit.modalBody}</p>
            </div>
          </Modal>
        </Section>

        <Section title={t.uiKit.minimap}>
          <Minimap modules={MODULES.map((m) => ({ ...m, alert: m.id === "power" }))} crew={[{ id: "a", x: 10, y: 15, color: "#9be43a" }]} />
          <div className="flex flex-col gap-2">
            <SpaceWeather level={weather} />
            <div className="flex gap-1">
              {(["calm", "active", "storm"] as const).map((l) => (
                <PixelButton key={l} variant={weather === l ? "primary" : "ghost"} aria-pressed={weather === l} onClick={() => setWeather(l)}>
                  {t.spaceWeather[l]}
                </PixelButton>
              ))}
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
