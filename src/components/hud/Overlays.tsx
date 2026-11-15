"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PixelSprite } from "./PixelSprite";
import { PixelButton } from "./PixelButton";
import { useAudio, useI18n } from "@/lib/providers";
import { usePrefersReducedMotion } from "@/lib/hooks";
import type { IconName, SpriteName } from "@/sprites/sprites.config";

/* ------------------------------------------------------------------ */
/* Diálogo del asistente con efecto máquina de escribir                */
/* ------------------------------------------------------------------ */

type DialogBoxProps = {
  speaker: string;
  text: string;
  sprite?: SpriteName;
  onConfirm?: () => void;
  /** ms por carácter */
  speed?: number;
};

export function DialogBox({ speaker, text, sprite = "robot", onConfirm, speed = 28 }: DialogBoxProps) {
  const { t } = useI18n();
  const { play } = useAudio();
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(0);
  const done = reduced || n >= text.length;

  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setN(0);
    okRef.current?.focus({ preventScroll: true });
  }, [text]);

  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(() => {
      setN((x) => x + 1);
      if (n % 3 === 0) play("type");
    }, speed);
    return () => window.clearTimeout(id);
  }, [n, done, speed, play]);

  return (
    <div className="bevel rivets flex gap-3" style={{ padding: "calc(var(--px) * 5)" }}>
      <div className="bevel-inset scanlines shrink-0 self-start p-2">
        <PixelSprite sprite={sprite} anim={done ? "idle" : "talk"} scale={4} label={speaker} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-pixel text-lg text-amber">{speaker}</span>
        {/* Texto completo para lectores de pantalla; el animado es solo visual */}
        <p className="sr-only" aria-live="polite">
          {text}
        </p>
        <p aria-hidden className={`min-h-[3.75em] text-xl text-steel-50 ${done ? "" : "caret"}`}>
          {done ? text : text.slice(0, n)}
        </p>
        <div className="mt-2 flex justify-end gap-2">
          {/* 1er toque: muestra todo el texto. 2º toque: cierra. Recibe el foco (Enter/Espacio). */}
          <PixelButton ref={okRef} variant="primary" onClick={() => (done ? onConfirm?.() : setN(text.length))}>
            {done ? t.dialog.ok : `${t.dialog.skip} ▸`}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Banner de alerta (tormenta solar, falla de oxígeno…)                */
/* ------------------------------------------------------------------ */

type AlertBannerProps = { icon: IconName; message: string; onDismiss?: () => void };

export function AlertBanner({ icon, message, onDismiss }: AlertBannerProps) {
  const { play } = useAudio();
  const { t } = useI18n();
  useEffect(() => {
    play("alert");
  }, [play, message]);
  return (
    <div
      role="alert"
      className="bevel alert-flash flex items-center gap-3 px-4 py-2"
      style={{ ["--bevel-fill" as string]: "var(--color-alert)", ["--bevel-light" as string]: "#ff8a99" }}
    >
      <PixelSprite icon={icon} scale={2} />
      <span className="font-pixel flex-1 text-xl text-steel-50 uppercase">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label={t.modal.close} className="bevel pixel-btn h-11 w-11 font-pixel">
          X
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal con marco metálico (usa <dialog> nativo: foco atrapado + Esc) */
/* ------------------------------------------------------------------ */

type ModalProps = { open: boolean; title: string; onClose: () => void; children: ReactNode };

export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // <dialog> enfoca el primer control (la X); preferimos el marcado con data-autofocus.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="bevel rivets pop-in m-auto w-[min(92vw,560px)] p-0 text-steel-50 backdrop:bg-void/80"
    >
      <header className="flex items-center justify-between bg-steel-900 py-1 pr-2 pl-4" style={{ margin: "calc(var(--px) * 2)" }}>
        <h2 id="modal-title" className="font-pixel text-xl text-neon-cyan uppercase">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.modal.close}
          className="bevel pixel-btn font-pixel h-11 w-11 text-lg"
          style={{ ["--bevel-fill" as string]: "var(--color-alert-dark)" }}
        >
          X
        </button>
      </header>
      <div className="px-6 pt-2 pb-6 text-xl">{children}</div>
    </dialog>
  );
}
