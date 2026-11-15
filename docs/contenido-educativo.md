# Contenido educativo y misión de Marte

Guía para quien edite textos, preguntas o medallas. El contenido vive en `src/game/learning.ts`; las reglas, en `API/docs/simulation-rules.md`.

## Cómo enseña el juego

| Pieza | Cuándo aparece | Dónde se guarda |
| --- | --- | --- |
| **Palabra nueva** (19) | La primera vez que ocurre algo relacionado: R0-B1 la explica con una comparación cotidiana | Bitácora (menú) |
| **Pregunta de R0-B1** (7) | Después de un suceso; tres opciones, sin castigo, siempre con explicación. Si se falla, vuelve a salir en otra partida | Cuenta para la medalla «Mente brillante» |
| **¿Qué pasaría si…?** | Antes de confirmar cualquier acción: el backend calcula el resultado sin guardarlo | — |
| **Informe del turno** | Al avanzar dos horas; en Marte incluye la lectura real de RAD | — |
| **Tutorial jugable** | Primera misión: seis pasos; en tres de ellos el niño hace la acción de verdad | Medalla «Cadete graduado» |
| **Medallas** (12) | Al cumplir su condición | Menú → Medallas |

Como mucho se muestra **una palabra y una pregunta por orden**, para no saturar. El progreso se guarda en el navegador (`selene.progress.v1`), sin cuentas ni datos personales.

## Reglas de escritura (7 a 12 años)

- Máximo 260 caracteres por explicación (lo comprueba `tests/unit/learning.test.ts`).
- Una idea por frase y una comparación con algo conocido (bloques, fogata, estornudo).
- El tecnicismo se nombra y se explica; no se sustituye por una palabra inventada.
- Los números de la simulación se presentan como reglas del juego; los de NASA, como «dato real».
- Todo texto existe en español e inglés.

## Datos reales de la misión de Marte

| Dato | Valor | Origen |
| --- | --- | --- |
| Radiación en la superficie, 20 de mayo de 2024 | De 3.8 a 246.4 uGy/h (media de dos horas); lectura máxima 304 uGy/h a las 06:15 UTC | MSL-RAD (rover Curiosity) vía API RadLab; captura `radlab-msl-rad-2024-05-20` |
| Eyección de masa coronal | Inicio 05:36 UTC; análisis de velocidad de 1,927 a 2,678 km/s | API DONKI; captura `donki-cme-2024-05-20` |
| Luz solar respecto a la Tierra | ≈ 43 % | Distancia media de Marte al Sol: 1.52 UA |
| Atmósfera | ≈ 95 % CO₂ | NASA Mars Fact Sheet |
| Duración de un sol | 24 h 39 min 35 s | NASA |
| Retraso de radio | Rango general 3–22 minutos por sentido; el ejercicio fija 20 | NASA/JPL; valor concreto del ejercicio didáctico |
| MOXIE | Obtuvo oxígeno del CO₂ marciano en el rover Perseverance (2021–2023) | NASA / JPL |
| Tormenta global de polvo de 2018 | Dejó sin energía al rover Opportunity | NASA / JPL |

Lo que **no** es un dato real y el juego lo dice: la tormenta de polvo de la misión (ese día no hubo una), el aviso solar adelantado un turno, los consumos de la base y la conversión de uGy/h a puntos de exposición.

Simplificaciones de la base que los textos explican para no contradecir los datos reales (auditoría del 15-11-2026):

- **Reciclaje de agua:** la base recupera la mitad del agua usada; la Estación Espacial, casi el 98 %.
- **Invernadero:** solo da comida (no oxígeno) y es mucho más pequeño que uno real, que necesitaría decenas de m² por persona.
- **Polvo lunar:** en la Luna no hay viento; el polvo se levanta al trabajar afuera y se pega por electricidad estática.
- **Llamarada vs. partículas:** la luz de una llamarada llega en 8 minutos sin aviso; el refugio protege de las partículas que llegan después.

## Páginas de referencia

- DONKI: <https://ccmc.gsfc.nasa.gov/tools/DONKI/>
- RadLab: <https://visualization.osdr.nasa.gov/radlab/>
- Curiosity (MSL): <https://science.nasa.gov/mission/msl-curiosity/>
- Perseverance y MOXIE: <https://science.nasa.gov/mission/mars-2020-perseverance/>

## Añadir contenido

1. Palabra: nuevo elemento en `TERMS` con `on` (disparadores como `event:dust_storm`, `action:explore@mars`, `turn:3@lunar`).
2. Pregunta: nuevo elemento en `QUIZZES` con exactamente tres opciones.
3. Medalla: nuevo elemento en `MEDALS`; su función `earned` solo lee el estado confirmado por el backend.
4. Ejecuta `npm test`.

Consulta las nuevas metas, modos y límites en [correcciones de la auditoría](correcciones-auditoria.md). La radio sólo acredita datos nuevos; el modo de protección eléctrica lunar no representa una nube que tape el Sol.
