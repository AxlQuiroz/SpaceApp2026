import type { ReactNode } from "react";

type PanelProps = {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** remaches en las esquinas */
  rivets?: boolean;
  /** scanlines sutiles (se desactivan con prefers-reduced-motion) */
  scanlines?: boolean;
  /** contenido en hueco hundido (pantallas) */
  inset?: boolean;
  as?: "section" | "div" | "aside";
  "aria-label"?: string;
};

/** Panel metálico biselado. Ver `.bevel` en globals.css para la decisión de implementación. */
export function Panel({
  title,
  children,
  className = "",
  rivets = true,
  scanlines = false,
  inset = false,
  as: Tag = "section",
  ...rest
}: PanelProps) {
  return (
    <Tag
      {...rest}
      className={`bevel ${rivets ? "rivets" : ""} ${className}`}
      style={{ padding: "calc(var(--px) * 4)" }}
    >
      {title && (
        <header
          className="font-pixel mb-2 flex items-center gap-2 bg-steel-900 px-3 py-1 text-lg tracking-wide text-neon-cyan uppercase"
          style={{ boxShadow: "inset 0 calc(var(--px) * -1) 0 0 var(--color-steel-950)" }}
        >
          {title}
        </header>
      )}
      <div className={`${inset ? "bevel-inset p-3" : ""} ${scanlines ? "scanlines" : ""}`}>{children}</div>
    </Tag>
  );
}
