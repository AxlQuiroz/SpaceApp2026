# AstraNova · MVP 0.4.0

AstraNova permite dirigir una base lunar o marciana durante doce turnos de dos horas. El MVP está delimitado a una práctica educativa de recursos y decisiones para edades de 7 a 12 años. No pretende simular una misión espacial completa ni calcular seguridad humana.

## Uso para la presentación

Requisitos del equipo Windows: Git, Python 3.12 y Node.js 24. Desde la carpeta del repositorio:

```powershell
git pull origin main
.\RockieOS.cmd prepare
.\RockieOS.cmd test
.\RockieOS.cmd present
```

Abre `http://localhost:3000`. Elige Jugar, Luna y Cadete para la primera práctica. Usa una **misión nueva** para las reglas 1.2; las partidas guardadas conservan sus reglas 1.0 o 1.1. La ruta `?demo=1` muestra una aproximación visual y no sustituye al juego conectado a Python.

## Qué está terminado

| Capacidad | Comportamiento del MVP |
| --- | --- |
| Juego completo | Luna y Marte; dos dificultades; tutorial; doce turnos; resultados completos, parciales y fallidos |
| Decisiones | Dos acciones por turno; costes finitos; comparación del siguiente turno con y sin la acción |
| Protección | Aviso persistente mientras el bloque siguiente conserve radiación elevada; recomendación disponible también durante el pico; aviso junto a controles móviles |
| Objetivo lunar | Exposición final de juego de 20 puntos o menos, además de duración, salud, ciencia y reserva de alimentos |
| Radio en Marte | Una acción y 1 kWh; respuesta física elegida de 40 min, leída al avanzar dos horas; ciencia sólo por datos nuevos; informe de planificación con lecturas, ventana exterior y polvo del ejercicio |
| NASA | Observaciones históricas atribuibles; medias radiométricas derivadas; perfil, unidades, fechas, transformación y hash conservados en cada misión |
| Repetición | Condiciones reproducibles, incidentes simulados variables y comparación de intentos |
| Persistencia | Sesiones anónimas, partidas guardadas, pausa, reanudación, recuperación de órdenes e idempotencia |
| Interfaz | ES/EN, teclado, foco en modales, acciones con explicación y coste de oportunidad explícito |
| Progreso | Medallas, bitácora y vestidor; reparar a tiempo funciona también cuando la fuga varía de turno |
| Familias | Diploma básico imprimible y preguntas para jugar juntos; Plan Familiar identificado como propuesta sin cobros |
| Distribución | Lanzador Windows y configuración de los tres servicios para Docker Compose |
| Licencia | MIT para el código del equipo; datos científicos y terceros conservan sus términos, ver NOTICE |

## Una comparación que explica el aprendizaje

Luna, cadete, semilla 42: dos exploraciones iniciales, reparar la fuga al aparecer y reparar los paneles dañados. Si se omite el refugio, la tripulación puede conservar salud completa y aun así **no cumplir la protección**. Entrar antes del incidente y salir después permite cumplirla. La salud y los puntos de exposición son variables distintas del modelo educativo.

En Marte, después de explorar en el turno 2 sólo queda una acción. Se puede transmitir el lote y esperar la respuesta, o entrar al refugio. La primera opción obtiene información y un premio de ciencia por datos nuevos, pero consume energía y aumenta la exposición al avanzar sin refugio. La segunda reduce esa exposición y deja el informe para después. La respuesta nunca protege automáticamente a la tripulación.

El informe de la Tierra muestra información de **este ejercicio histórico y sus incidentes simulados**. No representa un pronóstico NASA actual. Su vigencia termina después de dos turnos y los consejos vencidos se retiran de la vista.

## Reglas y compatibilidad

Las misiones nuevas usan `lunar-1.2.0` y `mars-1.2.0`. La ponderación es 30 puntos por duración, 20 por salud, 20 por ciencia, 20 por protección y 10 por alimento. Todos los objetivos deben cumplirse para ganar; una misión completada con objetivos pendientes tiene resultado parcial. La meta lunar de 20 puntos es didáctica, no un umbral médico.

Las versiones 1.0 y 1.1 mantienen su cálculo de recursos, objetivos, premios y puntuación. Reiniciar conserva la versión y el archivo del intento anterior. El código nuevo añade avisos de interfaz, pero no reinterpreta el balance de una partida guardada.

## Validación y cierre externo

Las regresiones comprueban aviso sostenido, medalla de fuga variable, protección lunar, compatibilidad 1.1, radio con coste, persistencia del informe y vigencia de consejos. El plan viable se prueba en 24 combinaciones de destino, dificultad, modo y semilla. CI verifica Linux, Windows, contratos, compilación y navegador.

Las pruebas automáticas no son una prueba de eficacia educativa. El [protocolo con usuarios](prueba-con-usuarios.md) está preparado y debe registrar observaciones reales. Tampoco se debe anunciar una publicación o envío oficial por tener un commit: el equipo debe comprobar el alojamiento elegido, los enlaces sin permisos especiales y la confirmación del portal.

Para publicar: [guía de despliegue](despliegue.md). Para presentar el proyecto y sus fuentes: [ficha en inglés](project-submission.md).
