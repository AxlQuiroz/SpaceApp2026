"use client";

import { Modal, PixelSprite } from "@/components/hud";
import { reviewText } from "@/game/reviewText";
import { useI18n } from "@/lib/providers";
import type { IconName } from "@/sprites/sprites.config";

const ICONS: IconName[] = ["sun", "mars", "day", "flask"];

/** Fuentes NASA y créditos, accesibles desde el menú principal sin conexión al backend. */
export function CreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  return (
    <Modal open={open} title={t.credits.title} onClose={onClose}>
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-2">
        <p className="text-lg text-steel-200">{t.credits.intro}</p>
        <ul className="flex flex-col gap-2">
          {t.credits.sources.map(([name, desc], i) => (
            <li key={name} className="bevel-inset flex gap-3 p-2">
              <PixelSprite icon={ICONS[i]} scale={2} className="shrink-0" />
              <span>
                <span className="font-pixel block text-lg text-neon-cyan">{name}</span>
                <span className="text-lg text-steel-200">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-lg text-amber">{t.credits.rules}</p>
        <p className="text-base text-steel-200">{reviewText(locale).aiCredit}</p>
        <div className="flex items-center gap-3">
          <PixelSprite sprite="robot" anim="talk" scale={3} />
          <p className="text-lg">{t.credits.team}</p>
        </div>
        <p className="font-tiny text-xs text-steel-400">{t.credits.disclaimer}</p>
      </div>
    </Modal>
  );
}
