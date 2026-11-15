"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ICONS,
  PIXEL_PALETTE,
  SPRITES,
  recolor,
  type Frame,
  type IconName,
  type SpriteAnimation,
  type SpriteName,
} from "@/sprites/sprites.config";
import { usePrefersReducedMotion } from "@/lib/hooks";

type Props = {
  /** escala entera: 1 píxel del sprite = `scale` píxeles CSS */
  scale?: number;
  /** texto accesible; si se omite, el sprite es decorativo */
  label?: string;
  className?: string;
  paused?: boolean;
  /** cambia colores del sprite por clave de paleta, p.ej. { O: "C" } */
  swap?: Record<string, string>;
} &({ sprite: SpriteName; anim: string; icon?: never } | { icon: IconName; sprite?: never; anim?: never });

/** Convierte un frame en rectángulos, uniendo píxeles iguales contiguos por fila. */
function frameToRects(frame: Frame) {
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      if (ch !== "." && PIXEL_PALETTE[ch]) rects.push({ x, y, w, fill: PIXEL_PALETTE[ch] });
      x += w;
    }
  });
  return rects;
}

export function PixelSprite({ scale = 3, label, className, paused, swap, ...rest }: Props) {
  const reduced = usePrefersReducedMotion();
  const animation: SpriteAnimation | undefined =
    "icon" in rest && rest.icon
      ? ICONS[rest.icon]
      : (SPRITES[rest.sprite as SpriteName] as Record<string, SpriteAnimation>)[rest.anim as string];

  const [frameIdx, setFrameIdx] = useState(0);
  const count = animation?.external?.frameCount ?? animation?.frames.length ?? 1;

  useEffect(() => {
    setFrameIdx(0);
    if (!animation || count <= 1 || paused || reduced) return;
    const id = window.setInterval(() => setFrameIdx((i) => (i + 1) % count), 1000 / animation.fps);
    return () => window.clearInterval(id);
  }, [animation, count, paused, reduced]);

  const swapKey = swap ? JSON.stringify(swap) : "";
  const rectsPerFrame = useMemo(
    () => animation?.frames.map((f) => frameToRects(swap ? recolor(f, swap) : f)) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [animation, swapKey],
  );

  if (!animation) return null;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  // Spritesheet externo (arte hecho a mano en /public/sprites)
  if (animation.external) {
    const { src, frameSize } = animation.external;
    const size = frameSize * scale;
    return (
      <span
        {...a11y}
        className={className}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          backgroundImage: `url(${src})`,
          backgroundSize: `${size * count}px ${size}px`,
          backgroundPosition: `-${frameIdx * size}px 0`,
          imageRendering: "pixelated",
        }}
      />
    );
  }

  const frame = animation.frames[frameIdx] ?? animation.frames[0];
  const w = frame[0].length;
  const h = frame.length;
  return (
    <svg
      {...a11y}
      className={`pixel ${className ?? ""}`}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
    >
      {rectsPerFrame[frameIdx]?.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  );
}
