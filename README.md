# Base Selene — NASA Space Apps

Juego educativo (7-12 años) de supervivencia en una base lunar, con HUD pixel art de estrategia sci-fi.
Especificación de diseño: [`Claude.md`](./Claude.md).

## Arrancar

1. Enciende el backend (rama `codex/backend-v0.2.0`, carpeta `API/`, ver su README). Debe quedar en `http://127.0.0.1:8000`.
2. Frontend:

```bash
npm install
cp .env.local.example .env.local   # ORBITA_API_URL y APP_ORIGIN
npm run dev                        # http://localhost:3000
```

- `/` — pantalla de título
- `/mision` — el juego (dificultad → HUD por turnos)
- `/ui-kit` — catálogo de componentes (oculto, `noindex`)
- `/mision?demo=1` — **el juego sin backend**: usa `src/lib/orbita/mock.ts`, un backend falso en el
  navegador con números aproximados. Sólo para ver la interfaz; las reglas reales están en Python.

> ⚠️ **Windows + `core.autocrlf=true`**: git convierte los saltos de línea de
> `API/services/resource-api/src/resource_api/snapshots/*.json` y rompe su verificación SHA
> (`SNAPSHOT_INTEGRITY_FAILED` → crear misión da 503). Solución: añadir en la rama del backend un
> `.gitattributes` con `API/**/snapshots/*.json -text`, o clonar con `git -c core.autocrlf=false`.

## Cómo encaja con el backend

El motor de reglas vive en Python; el frontend **no** recalcula nada. `src/game/useMission.ts` usa el
SDK (`src/lib/orbita/`) a través del proxy `src/app/api/mission/[...path]/route.ts`, que guarda la sesión
en una cookie HttpOnly. `src/game/model.ts` sólo traduce el `MissionView` a lo que dibuja el HUD.

| Backend | HUD |
|---|---|
| 9 `available_actions` | Tarjeta de comandos 3x3 (Q…C), bloqueadas si `enabled=false` |
| `advance` | Botón "Avanzar 2 horas" / tecla Espacio |
| `alerts` | Banner (sólo alertas nuevas) + insignias |
| eventos `water_leak`, `solar_warning`, `solar_incident`, `panel_damage` | Narración de R0-B1, clima espacial, módulos dañados |
| `/evaluation` | Modal de fin de misión |
| `/science` | Modal "Fuentes NASA" |

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/app/globals.css` | Paleta (24 colores en `@theme`), unidad `--px`, bisel, remaches, scanlines, animaciones por pasos, `prefers-reduced-motion` |
| `src/sprites/sprites.config.ts` | Sprites como arrays de píxeles (astronauta, robot, invernadero, iconos) |
| `public/sprites/` | Spritesheets PNG opcionales que sustituyen a los de código |
| `src/components/hud/` | Panel, PixelButton, StatBar, ResourceCounter, Tooltip, CommandCard, Portrait/UnitPanel, Minimap, SpaceWeather, DialogBox, AlertBanner, Modal, Starfield, SettingsBar |
| `src/i18n/dictionaries.ts` | Textos ES/EN (TypeScript avisa si falta una clave) |
| `src/lib/providers.tsx` | Contexto de idioma y audio |
| `src/lib/audio.ts` | Efectos chiptune con Web Audio (sin archivos), silenciado por defecto |

## Decisiones de diseño

- **Bisel con `box-shadow` por capas** en vez de `border-image`/9-slice: sin imágenes, recoloreable con variables y escalable con `--px`.
- **`--px`** = 2/3/4 px según el ancho: todos los bordes son múltiplos enteros, nada se ve borroso.
- **Sprites en SVG** con `shape-rendering="crispEdges"`, uniendo píxeles contiguos en rectángulos.
- **Modal con `<dialog>` nativo**: foco atrapado y cierre con Esc sin librerías.
- **Accesibilidad**: icono + texto siempre, `aria-label`/`role="meter"`, teclas Q-C con `aria-keyshortcuts`, objetivos ≥ 44 px, minimapa colapsable en móvil.
