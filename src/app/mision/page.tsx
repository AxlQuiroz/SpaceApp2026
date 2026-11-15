"use client";

import { useState } from "react";
import { Panel, PixelButton, PixelSprite, SettingsBar, Starfield } from "@/components/hud";
import { MissionHud } from "@/game/MissionHud";
import { isDemo, useMission, type ScenarioId } from "@/game/useMission";
import { missionErrorText, reviewText } from "@/game/reviewText";
import { useI18n } from "@/lib/providers";

export default function MissionPage() {
  const game = useMission();
  const { t, locale } = useI18n();
  const copy = reviewText(locale);
  const [practiceMode, setPracticeMode] = useState<"historical" | "training">("historical");
  const [difficulty, setDifficulty] = useState<"cadet" | "commander">("cadet");
  const [destination, setDestination] = useState<ScenarioId>("lunar-outpost-v1");
  // Marte sólo se ofrece si el backend conectado ya lo incluye.
  const destinations = (["lunar-outpost-v1", "mars-outpost-v1"] as const).filter((id) => game.scenarios.some((sc) => sc.id === id));
  const mars = destination === "mars-outpost-v1";

  if (game.phase === "playing" && game.mission) {
    // key: cada partida estrena su propio HUD (alertas, cola de R0-B1 y tutorial empiezan limpios).
    return <MissionHud key={game.mission.state.id} game={{ ...game, mission: game.mission }} />;
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-8">
      <div className="absolute inset-0">
        <Starfield />
      </div>
      <Panel className="relative z-10 w-full max-w-3xl" scanlines>
        <div className="flex flex-col items-center gap-4 p-2 text-center">
          <h1 className="font-pixel text-4xl text-neon-cyan">{t.app.title}</h1>

          {game.phase === "connecting" && (
            <>
              <PixelSprite sprite="robot" anim="talk" scale={5} label="R0-B1" />
              <p className="blink text-2xl">{t.menu.connecting}</p>
            </>
          )}

          {game.phase === "offline" && (
            <>
              <PixelSprite sprite="robot" anim="idle" scale={5} label="R0-B1" />
              <h2 className="font-pixel text-2xl text-alert">{t.menu.offlineTitle}</h2>
              <p className="text-xl text-steel-200">{t.menu.offlineBody}</p>
              {game.error && <p className="font-tiny text-xs text-steel-400">{missionErrorText(game.error, locale, game.errorCode)}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                <PixelButton variant="primary" disabled={game.busy || game.retryIn > 0} onClick={() => void game.connect()}>
                  {t.menu.retry}{game.retryIn > 0 ? ` (${game.retryIn}s)` : ""}
                </PixelButton>
                {/* recarga completa: el cliente (real o demo) se elige al montar */}
                <a href="/mision?demo=1" className="bevel pixel-btn font-pixel inline-flex items-center px-4 py-2 text-lg uppercase">
                  {t.menu.demo}
                </a>
              </div>
              <p className="font-tiny text-xs text-steel-400">{t.menu.demoNote}</p>
            </>
          )}

          {game.phase === "menu" && (
            <>
              <fieldset className="grid w-full gap-3 sm:grid-cols-2">
                <legend className="font-pixel mb-2 text-lg text-amber uppercase">{t.destination.title}</legend>
                {destinations.map((id) => {
                  const isMarsCard = id === "mars-outpost-v1";
                  return (
                    <label
                      key={id}
                      className={`bevel pixel-btn relative flex cursor-pointer flex-col items-center gap-2 p-4 ${destination === id ? "glow" : ""}`}
                      style={{ ["--bevel-fill" as string]: destination === id ? (isMarsCard ? "var(--color-mars-dark)" : "var(--color-cyan-dark)") : "var(--color-steel-800)" }}
                    >
                      <input type="radio" name="destination" value={id} checked={destination === id} onChange={() => setDestination(id)} className="sr-only" />
                      <PixelSprite icon={isMarsCard ? "mars" : "day"} scale={4} />
                      <span className="font-pixel text-2xl">{isMarsCard ? t.destination.mars : t.destination.moon}</span>
                      <span className="text-lg text-steel-200">{isMarsCard ? t.destination.marsDesc : t.destination.moonDesc}</span>
                      {!isMarsCard && <span className="font-tiny bg-lime px-2 py-0.5 text-xs text-void uppercase">{t.destination.recommended}</span>}
                    </label>
                  );
                })}
              </fieldset>
              <p className="text-xl text-steel-200">{mars ? t.destination.goalMars : t.destination.goalMoon}</p>
              {game.savedMissions.length > 0 && (
                <section className="w-full text-left" aria-label={t.menu.saved}>
                  <h2 className="font-pixel text-xl text-neon-cyan">{t.menu.saved}</h2>
                  <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto py-2">
                    {game.savedMissions.map(m => (
                      <li key={m.id}>
                        <PixelButton className="w-full" disabled={game.busy || game.hasPending} onClick={() => void game.openMission(m.id)}>
                          {t.menu.continue} · {m.scenario_id === "mars-outpost-v1" ? t.destination.mars : t.destination.moon} · {t.game.turn} {m.turn}/12 · {t.missionStatus[m.status]} · {m.id.slice(0, 6)}
                        </PixelButton>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <fieldset className="grid w-full gap-3 sm:grid-cols-2">
                <legend className="font-pixel mb-2 text-lg text-amber uppercase">{t.menu.difficulty}</legend>
                {(["cadet", "commander"] as const).map((d) => (
                  <label
                    key={d}
                    className={`bevel pixel-btn flex cursor-pointer flex-col items-center gap-2 p-4 ${difficulty === d ? "glow" : ""}`}
                    style={{
                      ["--bevel-fill" as string]: difficulty === d ? "var(--color-cyan-dark)" : "var(--color-steel-800)",
                    }}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={d}
                      checked={difficulty === d}
                      onChange={() => setDifficulty(d)}
                      className="sr-only"
                    />
                    <PixelSprite sprite="astronaut" anim={d === "cadet" ? "idle" : "work"} scale={4} />
                    <span className="font-pixel text-2xl">{t.menu[d]}</span>
                    <span className="text-lg text-steel-200">{d === "cadet" ? t.menu.cadetDesc : t.menu.commanderDesc}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="w-full text-left"><legend className="font-pixel text-lg text-amber">{copy.simulation}</legend><div className="flex flex-wrap gap-3">{(["historical", "training"] as const).filter(mode => !isDemo() || mode === "historical").map(mode => <label key={mode} className="bevel flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2"><input type="radio" name="practice-mode" checked={practiceMode === mode} onChange={() => setPracticeMode(mode)} />{mode === "historical" ? copy.historicalMode : copy.training}</label>)}</div><p className="mt-2 text-base text-steel-200">{copy.modeNote}</p></fieldset>
              <PixelButton
                variant="primary"
                className="px-8 text-2xl"
                disabled={game.busy || game.hasPending}
                onClick={() => void game.start({ scenario_id: destination, difficulty, practice_mode: practiceMode, seed: Math.floor(Math.random() * 1_000_000) })}
                icon={<PixelSprite icon="next" scale={3} />}
              >
                {game.busy ? "…" : t.menu.play}
              </PixelButton>
              {game.error && <p role="alert" className="text-alert">{missionErrorText(game.error, locale, game.errorCode)}</p>}
              {game.canRetry && <PixelButton disabled={game.busy || game.retryIn > 0} onClick={() => void game.retry()}>{t.menu.retry}{game.retryIn > 0 ? ` (${game.retryIn}s)` : ""}</PixelButton>}
            </>
          )}

          <SettingsBar />
        </div>
      </Panel>
    </main>
  );
}

