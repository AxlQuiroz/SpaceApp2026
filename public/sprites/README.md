# /public/sprites

Arte hecho a mano que reemplaza a los sprites generados por código.

1. Exporta un spritesheet PNG horizontal (frames de izquierda a derecha, 16x16 cada uno).
2. Guárdalo aquí, p. ej. `astronaut-idle.png`.
3. En `src/sprites/sprites.config.ts`, añade a la animación:

```ts
idle: { fps: 2, frames: [...], external: { src: "/sprites/astronaut-idle.png", frameSize: 16, frameCount: 2 } }
```

`<PixelSprite>` usará el PNG con `image-rendering: pixelated`.
