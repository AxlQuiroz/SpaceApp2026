"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dictionaries, type Dict, type Locale } from "@/i18n/dictionaries";
import { ChipSynth, type Sfx } from "@/lib/audio";

/* ---------------------------- Idioma ---------------------------- */

type I18nCtx = { locale: Locale; t: Dict; setLocale: (l: Locale) => void };
const I18nContext = createContext<I18nCtx | null>(null);

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* modo privado: ignorar */
  }
}

/* ---------------------------- Audio ---------------------------- */

type AudioCtx = {
  muted: boolean;
  volume: number;
  setMuted: (m: boolean) => void;
  setVolume: (v: number) => void;
  play: (sfx: Sfx) => void;
};
const AudioContextReact = createContext<AudioCtx | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");
  const [muted, setMutedState] = useState(true); // apagado por defecto
  const [volume, setVolumeState] = useState(0.5);
  const synth = useRef<ChipSynth | null>(null);

  useEffect(() => {
    const l = readStorage("selene.locale");
    if (l === "es" || l === "en") setLocaleState(l);
    const v = Number(readStorage("selene.volume"));
    if (!Number.isNaN(v) && v > 0) setVolumeState(Math.min(1, v));
    if (readStorage("selene.muted") === "false") setMutedState(false);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writeStorage("selene.locale", l);
  }, []);
  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    writeStorage("selene.muted", String(m));
  }, []);
  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    writeStorage("selene.volume", String(v));
  }, []);
  const play = useCallback(
    (sfx: Sfx) => {
      if (muted) return;
      synth.current ??= new ChipSynth();
      synth.current.play(sfx, volume);
    },
    [muted, volume],
  );

  const i18n = useMemo(() => ({ locale, t: dictionaries[locale] as Dict, setLocale }), [locale, setLocale]);
  const audio = useMemo(
    () => ({ muted, volume, setMuted, setVolume, play }),
    [muted, volume, setMuted, setVolume, play],
  );

  return (
    <I18nContext.Provider value={i18n}>
      <AudioContextReact.Provider value={audio}>{children}</AudioContextReact.Provider>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <Providers>");
  return ctx;
}

export function useAudio() {
  const ctx = useContext(AudioContextReact);
  if (!ctx) throw new Error("useAudio debe usarse dentro de <Providers>");
  return ctx;
}
