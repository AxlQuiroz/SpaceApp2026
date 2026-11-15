# SpaceApp2026 · RockieOS

**RockieOS** es un entrenador de decisiones y recursos para bases en la Luna y Marte, con referencias científicas de NASA. El frontend (juego pixel art para niños de 7 a 12 años) está en la raíz del repo con Next.js; el backend, en `API/`.

El **backend v0.3.0** se encuentra en [`API/`](API/README.md). Incluye la API interna de recursos NASA, el motor lunar y marciano, partidas persistentes en SQLite, el contrato OpenAPI, un cliente TypeScript y el adaptador para Next.js App Router.

## Actualización 0.3 y reglas 1.1

Las misiones nuevas exigen ciencia obtenida de datos nuevos y una reserva alimentaria final. La previsualización compara el siguiente turno con y sin la acción. El archivo radiométrico y su transformación quedan fijados en cada partida. Repetir un intento permite comparar resultados y decisiones; el entrenamiento variado cambia sólo incidentes simulados.

Las partidas anteriores mantienen las reglas 1.0. Para jugar con el balance nuevo, crea una misión desde el menú. Consulta el [detalle de las correcciones](docs/correcciones-auditoria.md), la [ficha de entrega](docs/project-submission.md) y los [créditos de datos e IA](CREDITS.md).

## Empezar

En Windows, con **Python 3.12 y Node.js 24** instalados, abre **[`RockieOS.cmd`](RockieOS.cmd)** con doble clic. Elige **1** para preparar las dependencias y **2** para iniciar la presentación. El mismo menú ejecuta pruebas, abre informes y ofrece un modo de desarrollo. `Ctrl+C` detiene los servicios y regresa al menú.

Consulta la [guía del lanzador y presentación](docs/lanzador-windows.md). También puedes seguir la [instalación manual del backend](API/docs/backend-installation-windows.md).

Para preparar la entrega, usa el [guion de presentación y los planes de ensayo](docs/guion-presentacion.md). La [consola de acciones](docs/pulido-interfaz.md) muestra nombres, costes, estado y motivos de bloqueo en escritorio y móvil.

- [Conectar el frontend Next.js](API/docs/nextjs-integration.md).
- [Contrato de partidas](API/docs/mission-api-contract.md).
- [Reglas del simulador](API/docs/simulation-rules.md).
- [Pruebas y límites de la validación](API/docs/backend-validation.md).

GitHub Actions verifica Python en Linux y Windows, contratos, frontend, compilación de producción y partidas completas desde Chromium en escritorio y móvil. Las pruebas usan capturas históricas, sin claves NASA ni acceso a sus proveedores. Consulta [pruebas y recuperación](docs/pruebas-del-proyecto.md).

## Frontend · RockieOS

Entrenador de decisiones (7–12 años) para bases lunares y marcianas, con HUD pixel art de estrategia sci-fi.
Diseño y navegación: [consola de decisiones y flujo de presentación](docs/pulido-interfaz.md).

### Arrancar

1. Enciende el backend (carpeta `API/`, ver su README). Debe quedar en `http://127.0.0.1:8000`.
2. Frontend:

```bash
npm ci
cp .env.local.example .env.local   # ORBITA_API_URL y APP_ORIGIN
npm run dev                        # http://localhost:3000
```

- `/` — pantalla de título
- `/mision` — el juego (dificultad → HUD por turnos)
- `/ui-kit` — catálogo de componentes (oculto, `noindex`)
- `/mision?demo=1` — **el juego sin backend**: usa `src/lib/orbita/mock.ts`, un backend falso en el
  navegador con números aproximados. Sólo para ver la interfaz; las reglas reales están en Python.

Las capturas NASA están protegidas por `.gitattributes`. El lanzador del backend también puede corregir conversiones CRLF de clones anteriores, verificando el SHA-256 original. Una captura con cambios de contenido se rechaza. Ver [diagnóstico y reparación](docs/pruebas-del-proyecto.md#capturas-en-windows).

### Misiones y aprendizaje

| Misión | Qué la hace distinta |
| --- | --- |
| **Luna** (`lunar-outpost-v1`) | Fuga de agua, tormenta solar (DONKI, 10 de mayo de 2024) y polvo lunar |
| **Marte** (`mars-outpost-v1`) | La radiación de cada turno sigue las mediciones reales del rover Curiosity (MSL-RAD, 20 de mayo de 2024), tormenta de polvo, oxígeno del aire marciano (MOXIE) y llamadas a la Tierra con retraso |

R0-B1 explica cada tecnicismo la primera vez que aparece (bitácora), hace mini-preguntas sin castigo, muestra
«¿Qué pasaría si…?» antes de confirmar una acción y entrega medallas. La primera misión empieza con un tutorial jugable.

- Contenido y datos reales: [`docs/contenido-educativo.md`](docs/contenido-educativo.md).
- Reglas de Marte: [`API/docs/simulation-rules.md`](API/docs/simulation-rules.md).
- Modelo de negocio (familias, sin ventajas por pagar): [`docs/modelo-de-negocio.md`](docs/modelo-de-negocio.md).

### Cómo encaja con el backend

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

El menú permite volver a las misiones guardadas, pausarlas y reanudarlas. Un fallo temporal no elimina la referencia de la partida. Las órdenes pendientes conservan su UUID y cuerpo, incluso al recargar la misma pestaña; no se permite iniciar otra decisión hasta resolverlas. Si la sesión expira, las órdenes anteriores no se aplican a la nueva sesión. La conservación tras recargar requiere almacenamiento del navegador habilitado.

`APP_ORIGIN` debe coincidir con el origen exacto utilizado en el navegador. Si abres la web con otra IP, dominio o puerto, actualiza esa variable en `.env.local` y reinicia Next.js. Las sesiones anónimas siguen teniendo el vencimiento documentado por el backend.

### Estructura

| Ruta | Qué hay |
|---|---|
| `src/app/globals.css` | Paleta (24 colores en `@theme`), unidad `--px`, bisel, remaches, scanlines, animaciones por pasos, `prefers-reduced-motion` |
| `src/sprites/sprites.config.ts` | Sprites como arrays de píxeles (astronauta, robot, invernadero, iconos) |
| `public/sprites/` | Spritesheets PNG opcionales que sustituyen a los de código |
| `src/components/hud/` | Panel, PixelButton, StatBar, ResourceCounter, Tooltip, CommandCard, Portrait/UnitPanel, Minimap, SpaceWeather, DialogBox, AlertBanner, Modal, Starfield, SettingsBar |
| `src/i18n/dictionaries.ts` | Textos ES/EN (TypeScript avisa si falta una clave) |
| `src/lib/providers.tsx` | Contexto de idioma y audio |
| `src/lib/audio.ts` | Efectos chiptune con Web Audio (sin archivos), silenciado por defecto |

### Decisiones de diseño

- **Bisel con `box-shadow` por capas** en vez de `border-image`/9-slice: sin imágenes, recoloreable con variables y escalable con `--px`.
- **`--px`** = 2/3/4 px según el ancho: todos los bordes son múltiplos enteros, nada se ve borroso.
- **Sprites en SVG** con `shape-rendering="crispEdges"`, uniendo píxeles contiguos en rectángulos.
- **Modal con `<dialog>` nativo**: foco atrapado y cierre con Esc sin librerías.
- **Accesibilidad**: icono + texto siempre, `aria-label`/`role="meter"`, teclas Q-C con `aria-keyshortcuts`, objetivos ≥ 44 px, minimapa colapsable en móvil.

