"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  content: ReactNode;
  children: (describedBy: string) => ReactNode;
  side?: "top" | "bottom";
};

/**
 * Tooltip pixelado. Se muestra con hover y con foco de teclado.
 * El hijo recibe el id para `aria-describedby`.
 */
export function Tooltip({ content, children, side = "top" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className={`bevel font-mono-read pointer-events-none absolute left-1/2 z-30 w-max max-w-56 -translate-x-1/2 px-3 py-1 text-lg text-steel-50 ${
          side === "top" ? "bottom-full mb-3" : "top-full mt-3"
        } ${open ? "block" : "hidden"}`}
        style={{ ["--bevel-fill" as string]: "var(--color-steel-950)" }}
      >
        {content}
      </span>
    </span>
  );
}
