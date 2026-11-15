"use client";

import Link from "next/link";
import { Panel, PixelSprite, SettingsBar, Starfield } from "@/components/hud";
import { useI18n } from "@/lib/providers";

/** Pantalla de título. */
export default function Home() {
  const { t } = useI18n();
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="absolute inset-0">
        <Starfield />
      </div>
      <Panel className="relative z-10 max-w-xl text-center" scanlines>
        <div className="flex flex-col items-center gap-4 p-4">
          <div className="flex items-end gap-4">
            <PixelSprite sprite="astronaut" anim="celebrate" scale={5} />
            <PixelSprite sprite="greenhouse" anim="normal" scale={5} />
            <PixelSprite sprite="robot" anim="idle" scale={5} />
          </div>
          <h1 className="font-pixel text-5xl text-neon-cyan">{t.app.title}</h1>
          <p className="text-2xl text-steel-200">{t.app.subtitle}</p>
          <Link
            href="/mision"
            className="bevel pixel-btn font-pixel inline-flex items-center gap-3 px-8 py-3 text-3xl text-steel-50 uppercase"
            style={{ ["--bevel-fill" as string]: "var(--color-cyan-dark)" }}
          >
            <PixelSprite icon="next" scale={3} />
            {t.menu.play}
          </Link>
          <SettingsBar />
        </div>
      </Panel>
    </main>
  );
}
