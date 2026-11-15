"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

const W = 320;
const H = 180;

/**
 * Fondo de estrellas con paralaje en 3 capas. Se dibuja a baja resolución
 * (320x180) y se escala con image-rendering: pixelated.
 */
export function Starfield({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    // Generador pseudoaleatorio fijo: el cielo es siempre el mismo.
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const layers = [
      { speed: 0.05, color: "#56667f", stars: Array.from({ length: 70 }, () => [rnd() * W, rnd() * H]) },
      { speed: 0.12, color: "#c3cedc", stars: Array.from({ length: 35 }, () => [rnd() * W, rnd() * H]) },
      { speed: 0.25, color: "#fff6d6", stars: Array.from({ length: 12 }, () => [rnd() * W, rnd() * H]) },
    ];

    let raf = 0;
    let t = 0;
    const draw = () => {
      ctx.fillStyle = "#0a0e16";
      ctx.fillRect(0, 0, W, H);
      layers.forEach((l, li) => {
        ctx.fillStyle = l.color;
        for (const [x, y] of l.stars) {
          const px = Math.floor((x - t * l.speed + W) % W);
          ctx.fillRect(px, Math.floor(y), 1, 1);
          if (li === 2) {
            ctx.fillRect(px - 1, Math.floor(y), 1, 1);
          }
        }
      });
      t += 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      aria-hidden
      className={`pointer-events-none h-full w-full object-cover ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
