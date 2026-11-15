"use client";

import { useState } from "react";
import { Badge, Modal, PixelButton, PixelSprite } from "@/components/hud";
import { useI18n } from "@/lib/providers";
import { MEDALS, type Lang } from "@/game/learning";
import { DEFAULT_LOOK, SUITS, suitSwap, suitUnlocked } from "@/game/wardrobe";

type Props = {
  open: boolean;
  onClose: () => void;
  medals: string[];
  look: string[];
  dress: (crewIndex: number, suitId: string) => void;
};

/**
 * Vestidor para niñas y niños: solo trajes gratis y los que se ganan con medallas.
 * Los trajes del Plan Familiar no se muestran aquí (se ven en la zona de adultos),
 * para no presionar a nadie a pedir una compra.
 */
export function WardrobeModal({ open, onClose, medals, look, dress }: Props) {
  const { t, locale } = useI18n();
  const lang = locale as Lang;
  const [crew, setCrew] = useState(0);
  const suits = SUITS.filter((s) => s.unlock.kind !== "pass");

  return (
    <Modal open={open} title={t.wardrobe.title} onClose={onClose} wide>
      <p className="mb-3 text-lg text-steel-200">{t.wardrobe.intro}</p>

      <div role="radiogroup" aria-label={t.wardrobe.crew} className="mb-4 grid grid-cols-4 gap-2">
        {look.map((suitId, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={crew === i}
            data-autofocus={i === 0 ? true : undefined}
            onClick={() => setCrew(i)}
            className={`bevel pixel-btn flex flex-col items-center gap-1 p-2 ${crew === i ? "glow" : ""}`}
            style={{ ["--bevel-fill" as string]: crew === i ? "var(--color-cyan-dark)" : "var(--color-steel-800)" }}
          >
            <PixelSprite sprite="astronaut" anim={crew === i ? "celebrate" : "idle"} scale={3} swap={suitSwap(suitId)} />
            <span className="font-tiny text-xs uppercase">
              {t.wardrobe.crew} {i + 1}
            </span>
          </button>
        ))}
      </div>

      <ul className="grid max-h-[45vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {suits.map((suit) => {
          const unlocked = suitUnlocked(suit, medals);
          const wearing = look[crew] === suit.id;
          const medal = suit.unlock.kind === "medal" ? MEDALS.find((m) => m.id === (suit.unlock as { medal: string }).medal) : undefined;
          return (
            <li key={suit.id}>
              <button
                type="button"
                disabled={!unlocked}
                aria-pressed={wearing}
                onClick={() => dress(crew, suit.id)}
                className={`bevel pixel-btn flex h-full w-full flex-col items-center gap-1 p-2 text-center ${wearing ? "glow" : ""}`}
                style={{ ["--bevel-fill" as string]: wearing ? "var(--color-lime-dark)" : "var(--color-steel-800)" }}
              >
                <span className="relative">
                  <PixelSprite sprite="astronaut" anim="idle" scale={3} swap={suit.swap} paused={!unlocked} />
                  {!unlocked && (
                    <span className="absolute -right-2 -bottom-1">
                      <PixelSprite icon="lock" scale={2} />
                    </span>
                  )}
                </span>
                <span className="font-pixel text-base leading-tight">{suit.name[lang]}</span>
                {wearing ? (
                  <Badge tone="ok">{t.wardrobe.wearing}</Badge>
                ) : suit.unlock.kind === "free" ? (
                  <Badge tone="info">{t.wardrobe.free}</Badge>
                ) : unlocked ? (
                  <Badge tone="info">{t.wardrobe.medal}</Badge>
                ) : (
                  <span className="text-sm leading-tight text-steel-200">
                    {t.wardrobe.lockedMedal}: {medal?.name[lang]}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex justify-end">
        <PixelButton onClick={() => DEFAULT_LOOK.forEach((id, i) => dress(i, id))}>{t.wardrobe.reset}</PixelButton>
      </div>
    </Modal>
  );
}
