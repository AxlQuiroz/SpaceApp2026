"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { useAudio } from "@/lib/providers";

type Variant = "default" | "primary" | "danger" | "ghost";

const VARIANT_FILL: Record<Variant, string> = {
  default: "var(--color-steel-800)",
  primary: "var(--color-cyan-dark)",
  danger: "var(--color-alert-dark)",
  ghost: "var(--color-steel-900)",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: ReactNode;
  children?: ReactNode;
  /** sin sonido de clic */
  silent?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function PixelButton({ variant = "default", icon, children, className = "", silent, onClick, style, ...rest }: Props) {
  const { play } = useAudio();
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        if (!silent) play("click");
        onClick?.(e);
      }}
      className={`bevel pixel-btn font-pixel inline-flex items-center justify-center gap-2 px-4 py-2 text-lg text-steel-50 uppercase ${className}`}
      style={{ ["--bevel-fill" as string]: VARIANT_FILL[variant], ...style }}
    >
      {icon}
      {children}
    </button>
  );
}
