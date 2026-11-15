"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Panel, PixelButton, PixelSprite, SettingsBar, StatBar, Starfield } from "@/components/hud";
import { CreditsModal } from "@/components/menu/CreditsModal";
import { FamilyModal } from "@/components/menu/FamilyModal";
import { WardrobeModal } from "@/components/menu/WardrobeModal";
import { LogbookModal, MedalsModal } from "@/game/LearningCards";
import { MEDALS, QUIZZES, TERMS, useProgress } from "@/game/learning";
import { SUITS, suitSwap, useCrewLook } from "@/game/wardrobe";
import { useAudio, useI18n } from "@/lib/providers";
import type { IconName } from "@/sprites/sprites.config";

type Open = null | "medals" | "wardrobe" | "logbook" | "family" | "credits";

/** Pantalla de título: menú principal, tripulación, progreso y zona para familias. */
export default function Home() {
  const { t } = useI18n();
  const { progress } = useProgress();
  const { look, dress } = useCrewLook();
  const [open, setOpen] = useState<Open>(null);
  const [fact, setFact] = useState(0);
  const close = () => setOpen(null);

  // Dato inicial al azar (en el cliente, para no desajustar la hidratación).
  useEffect(() => setFact(Math.floor(Math.random() * t.home.facts.length)), [t.home.facts.length]);

  const medals = MEDALS.filter((m) => progress.medals.includes(m.id)).length;
  const words = TERMS.filter((term) => progress.terms.includes(term.id)).length;
  const quizzes = QUIZZES.filter((q) => progress.quizzes[q.id] === true).length;

  return (
    <main className="relative min-h-dvh overflow-x-hidden px-4 py-6">
      <div className="fixed inset-0">
        <Starfield />
      </div>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-4">
        {/* ================= TÍTULO ================= */}
        <Panel scanlines>
          <header className="flex flex-col items-center gap-3 p-2 text-center">
            <div className="flex items-end gap-4">
              <PixelSprite sprite="astronaut" anim="celebrate" scale={5} swap={suitSwap(look[0])} />
              <PixelSprite sprite="greenhouse" anim="normal" scale={5} />
              <PixelSprite sprite="robot" anim="idle" scale={5} />
            </div>
            <h1 className="font-pixel text-5xl text-neon-cyan">{t.app.title}</h1>
            <p className="max-w-2xl text-2xl text-steel-200">{t.home.tagline}</p>
          </header>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* ================= MENÚ ================= */}
          <Panel title={<><PixelSprite icon="gear" scale={2} /> {t.home.menuTitle}</>}>
            <nav aria-label={t.home.menuTitle} className="flex flex-col gap-3">
              <MenuEntry href="/mision" primary icon="next" label={t.home.play} hint={t.home.playHint} />
              <MenuEntry icon="medal" label={t.home.medals} hint={t.home.medalsHint} count={`${medals}/${MEDALS.length}`} onClick={() => setOpen("medals")} />
              <MenuEntry icon="heart" label={t.home.wardrobe} hint={t.home.wardrobeHint} onClick={() => setOpen("wardrobe")} sprite />
              <MenuEntry icon="book" label={t.home.logbook} hint={t.home.logbookHint} count={`${words}/${TERMS.length}`} onClick={() => setOpen("logbook")} />
              <div className="grid gap-3 sm:grid-cols-2">
                <MenuEntry icon="shelter" label={t.home.family} hint={t.home.familyHint} onClick={() => setOpen("family")} compact />
                <MenuEntry icon="antenna" label={t.home.credits} hint={t.home.creditsHint} onClick={() => setOpen("credits")} compact />
              </div>
            </nav>
          </Panel>

          <div className="flex flex-col gap-4">
            {/* ================= PLAN FAMILIAR (promoción para adultos; sin precio aquí) ================= */}
            <Panel title={<><PixelSprite icon="heart" scale={2} /> {t.home.planTitle}</>}>
              <button
                type="button"
                onClick={() => setOpen("family")}
                aria-haspopup="dialog"
                className="bevel pixel-btn glow relative flex w-full flex-col gap-2 p-3 text-left"
                style={{ ["--bevel-fill" as string]: "var(--color-steel-800)" }}
              >
                <span className="font-tiny absolute top-2 right-2 bg-amber px-2 py-0.5 text-xs text-void uppercase">{t.home.planBadge}</span>
                <span aria-hidden className="flex items-end justify-around pt-7">
                  {SUITS.filter((s) => s.unlock.kind === "pass").map((s, i) => (
                    <PixelSprite key={s.id} sprite="astronaut" anim={i % 2 ? "walk" : "celebrate"} scale={2} swap={s.swap} />
                  ))}
                </span>
                <span className="text-lg">{t.home.planPitch}</span>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-tiny text-xs text-steel-400 uppercase">{t.home.planFor}</span>
                  <span className="font-pixel bg-amber px-3 py-1 text-lg text-void uppercase">{t.home.planCta} ▸</span>
                </span>
              </button>
            </Panel>

            {/* ================= TRIPULACIÓN ================= */}
            <Panel title={<><PixelSprite icon="rest" scale={2} /> {t.home.crewTitle}</>}>
              <button
                type="button"
                onClick={() => setOpen("wardrobe")}
                aria-label={`${t.home.wardrobe}: ${t.home.wardrobeHint}`}
                className="bevel-inset pixel-btn relative block w-full overflow-hidden bg-sky"
              >
                <div className="flex items-end justify-around px-2 pt-4">
                  {look.map((id, i) => (
                    <PixelSprite key={i} sprite="astronaut" anim={i % 2 ? "walk" : "idle"} scale={3} swap={suitSwap(id)} />
                  ))}
                </div>
                <div className="h-3 bg-regolith" />
                <div className="h-2 bg-regolith-dark" />
              </button>
              <div className="mt-3 flex flex-col gap-2">
                <h2 className="font-pixel text-lg text-amber uppercase">{t.home.progressTitle}</h2>
                <StatBar label={t.home.medals} value={medals} max={MEDALS.length} segments={MEDALS.length} color="var(--color-amber)" />
                <StatBar label={t.home.words} value={words} max={TERMS.length} segments={Math.min(TERMS.length, 12)} color="var(--color-neon-cyan)" />
                <StatBar label={t.home.quizzes} value={quizzes} max={QUIZZES.length} segments={Math.min(QUIZZES.length, 12)} />
                <p className="flex flex-wrap items-center gap-2 text-lg">
                  <span className="font-tiny text-sm text-steel-200 uppercase">{t.home.training}:</span>
                  <span className={progress.tutorialDone ? "text-lime" : "text-steel-200"}>
                    {progress.tutorialDone ? t.home.trainingDone : t.home.trainingPending}
                  </span>
                </p>
              </div>
            </Panel>

            {/* ================= DATO DE R0-B1 ================= */}
            <Panel title={<><PixelSprite icon="flask" scale={2} /> {t.home.factTitle}</>}>
              <div className="flex gap-3">
                <div className="bevel-inset shrink-0 self-start p-2">
                  <PixelSprite sprite="robot" anim="talk" scale={3} label="R0-B1" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="min-h-[3em] text-xl" aria-live="polite">
                    {t.home.facts[fact % t.home.facts.length]}
                  </p>
                  <PixelButton className="self-end" onClick={() => setFact((f) => f + 1)}>
                    {t.home.nextFact} ▸
                  </PixelButton>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* ================= PIE ================= */}
        <Panel rivets={false}>
          <footer className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-lg text-steel-200">
              <PixelSprite icon="heart" scale={2} />
              {t.home.promise}
            </p>
            <SettingsBar />
          </footer>
        </Panel>
      </div>

      <MedalsModal open={open === "medals"} onClose={close} progress={progress} />
      <LogbookModal open={open === "logbook"} onClose={close} progress={progress} />
      <WardrobeModal open={open === "wardrobe"} onClose={close} medals={progress.medals} look={look} dress={dress} />
      <FamilyModal open={open === "family"} onClose={close} progress={progress} />
      <CreditsModal open={open === "credits"} onClose={close} />
    </main>
  );
}

/* ------------------------------------------------------------------ */

type EntryProps = {
  icon: IconName;
  label: string;
  hint: string;
  count?: string;
  primary?: boolean;
  compact?: boolean;
  /** muestra un astronauta en lugar del icono (vestidor) */
  sprite?: boolean;
  href?: string;
  onClick?: () => void;
};

/** Botón grande del menú: icono + texto siempre juntos, objetivo táctil amplio. */
function MenuEntry({ icon, label, hint, count, primary, compact, sprite, href, onClick }: EntryProps) {
  const { play } = useAudio();
  const className = `bevel pixel-btn flex w-full items-center gap-3 text-left ${compact ? "p-2" : "p-3"} ${primary ? "glow" : ""}`;
  const style = { ["--bevel-fill" as string]: primary ? "var(--color-cyan-dark)" : "var(--color-steel-800)" };
  const body: ReactNode = (
    <>
      <span className="bevel-inset grid shrink-0 place-items-center p-1" style={{ width: compact ? 44 : 56, height: compact ? 44 : 56 }}>
        {sprite ? <PixelSprite sprite="astronaut" anim="idle" scale={compact ? 2 : 3} /> : <PixelSprite icon={icon} scale={compact ? 2 : 3} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`font-pixel uppercase ${primary ? "text-4xl text-steel-50" : compact ? "text-xl" : "text-2xl"}`}>{label}</span>
        <span className={`${compact ? "text-base" : "text-lg"} text-steel-200`}>{hint}</span>
      </span>
      {count && <span className="font-pixel shrink-0 bg-steel-900 px-2 py-1 text-lg text-amber tabular-nums">{count}</span>}
    </>
  );
  if (href)
    return (
      <Link href={href} className={className} style={style} onClick={() => play("click")}>
        {body}
      </Link>
    );
  return (
    <button type="button" className={className} style={style} onClick={() => { play("click"); onClick?.(); }} aria-haspopup="dialog">
      {body}
    </button>
  );
}
