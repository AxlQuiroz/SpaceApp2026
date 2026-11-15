"use client";

import { useState } from "react";
import { Panel, PixelButton, PixelSprite, SettingsBar, Starfield } from "@/components/hud";
import { MissionHud } from "@/game/MissionHud";
import { useMission } from "@/game/useMission";
import { useI18n } from "@/lib/providers";

export default function MissionPage() {
  const game = useMission();
  const { t } = useI18n();
  const [difficulty, setDifficulty] = useState<"cadet" | "commander">("cadet");

  if (game.phase === "playing" && game.mission) {
    return <MissionHud game={{ ...game, mission: game.mission }} />;
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-8">
      <div className="absolute inset-0">
        <Starfield />
      </div>
      <Panel className="relative z-10 w-full max-w-2xl" scanlines>
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
              {game.error && <p className="font-tiny text-xs text-steel-400">{game.error}</p>}
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
              <p className="text-xl text-steel-200">{t.menu.goal}</p>
              {game.savedMissions.length > 0 && (
                <section className="w-full text-left" aria-label={t.menu.saved}>
                  <h2 className="font-pixel text-xl text-neon-cyan">{t.menu.saved}</h2>
                  <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto py-2">
                    {game.savedMissions.map(m => (
                      <li key={m.id}>
                        <PixelButton className="w-full" disabled={game.busy || game.hasPending} onClick={() => void game.openMission(m.id)}>
                          {t.menu.continue} · {t.game.turn} {m.turn}/12 · {t.missionStatus[m.status]} · {m.id.slice(0, 6)}
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
              <PixelButton
                variant="primary"
                className="px-8 text-2xl"
                disabled={game.busy || game.hasPending}
                onClick={() => void game.start({ difficulty, seed: Math.floor(Math.random() * 1_000_000) })}
                icon={<PixelSprite icon="next" scale={3} />}
              >
                {game.busy ? "…" : t.menu.play}
              </PixelButton>
              {game.error && <p role="alert" className="text-alert">{game.error}</p>}
              {game.canRetry && <PixelButton disabled={game.busy || game.retryIn > 0} onClick={() => void game.retry()}>{t.menu.retry}{game.retryIn > 0 ? ` (${game.retryIn}s)` : ""}</PixelButton>}
            </>
          )}

          <SettingsBar />
        </div>
      </Panel>
    </main>
  );
}

