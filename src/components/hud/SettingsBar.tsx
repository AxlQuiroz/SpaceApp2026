"use client";

import { useAudio, useI18n } from "@/lib/providers";
import { PixelButton } from "./PixelButton";

/** Silencio, volumen e idioma. Siempre visible. */
export function SettingsBar() {
  const { muted, setMuted, volume, setVolume, play } = useAudio();
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PixelButton
        silent
        aria-pressed={!muted}
        onClick={() => {
          setMuted(!muted);
        }}
        icon={<span aria-hidden>{muted ? "🔇" : "🔊"}</span>}
      >
        {muted ? t.settings.unmute : t.settings.mute}
      </PixelButton>
      <label className="font-tiny flex items-center gap-2 text-sm text-steel-200 uppercase">
        {t.settings.volume}
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={volume}
          disabled={muted}
          onChange={(e) => setVolume(Number(e.target.value))}
          onMouseUp={() => play("click")}
          className="h-11 w-28 accent-[var(--color-neon-cyan)]"
        />
      </label>
      <div role="group" aria-label={t.settings.language} className="flex gap-1">
        {(["es", "en"] as const).map((l) => (
          <PixelButton
            key={l}
            aria-pressed={locale === l}
            variant={locale === l ? "primary" : "ghost"}
            onClick={() => setLocale(l)}
          >
            {l.toUpperCase()}
          </PixelButton>
        ))}
      </div>
    </div>
  );
}
