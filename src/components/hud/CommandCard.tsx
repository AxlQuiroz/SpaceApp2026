"use client";

import { useEffect, useState } from "react";
import { PixelSprite } from "./PixelSprite";
import { Tooltip } from "./Tooltip";
import type { IconName } from "@/sprites/sprites.config";
import { useAudio, useI18n } from "@/lib/providers";

/** Teclas fijas por posición de la cuadrícula 3x3. */
export const HOTKEYS = ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"] as const;

export type Command = {
  id: string;
  icon: IconName;
  label: string;
  /** explicación corta para niños */
  hint?: string;
  locked?: boolean;
  onActivate?: () => void;
};

type Props = {
  /** hasta 9 posiciones; `null` = hueco vacío */
  commands: (Command | null)[];
  /** escuchar teclas globales Q..C */
  hotkeys?: boolean;
};

export function CommandCard({ commands, hotkeys = true }: Props) {
  const { t } = useI18n();
  const { play } = useAudio();
  const [pressed, setPressed] = useState<number | null>(null);
  const slots = Array.from({ length: 9 }, (_, i) => commands[i] ?? null);

  const trigger = (i: number) => {
    const c = slots[i];
    if (!c) return;
    if (c.locked) {
      play("error");
      return;
    }
    play("click");
    setPressed(i);
    window.setTimeout(() => setPressed(null), 120);
    c.onActivate?.();
  };

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
      const i = HOTKEYS.indexOf(e.key.toUpperCase() as (typeof HOTKEYS)[number]);
      if (i >= 0) trigger(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div role="toolbar" aria-label="Comandos" className="grid w-max grid-cols-3 gap-[calc(var(--px)*2)]">
      {slots.map((c, i) => {
        const key = HOTKEYS[i];
        if (!c) return <span key={i} className="bevel-inset h-14 w-14" aria-hidden />;
        const text = c.locked ? `${c.label} (${t.commands.locked})` : c.label;
        return (
          <Tooltip
            key={c.id}
            content={
              <>
                <strong className="font-pixel block text-neon-cyan">{text}</strong>
                {c.hint && <span className="block whitespace-pre-line">{c.hint}</span>}
                <span className="block text-steel-400">
                  {t.commands.hotkey}: {key}
                </span>
              </>
            }
          >
            {(describedBy) => (
              <button
                type="button"
                aria-label={text}
                aria-describedby={describedBy}
                aria-keyshortcuts={key}
                aria-disabled={c.locked || undefined}
                data-pressed={pressed === i}
                onClick={() => trigger(i)}
                className={`bevel pixel-btn relative flex h-14 w-14 items-center justify-center ${
                  c.locked ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                <PixelSprite icon={c.locked ? "lock" : c.icon} scale={2} />
                <span className="font-tiny absolute right-[2px] bottom-0 text-xs text-amber">{key}</span>
              </button>
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}
