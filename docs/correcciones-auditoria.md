# Correcciones de la auditoría · versión 0.3

> Registro de la iteración 0.3. El estado actual es el [MVP 0.4 y reglas 1.2](MVP.md), que también conserva las partidas 1.1, corrige la medalla variable, mantiene el aviso marciano y añade la meta de protección y el informe de radio. El código ya incluye licencia MIT.

La actualización conserva el menú, guardarropa y funciones de familias incorporados en main. El motor sigue en Python y la interfaz en Next.js; sus contratos se generan y se comprueban conjuntamente.

## Cambios y evidencia

| Revisión | Solución implementada | Comprobación |
| --- | --- | --- |
| R01 · Informes repetibles | Cada exploración reúne datos pendientes. El envío captura un lote; sólo un lote nuevo aporta el premio. Una consulta vacía devuelve consejo y cero ciencia. | Pruebas de envío, repetición y datos recogidos después del envío; la estrategia de cinco consultas desde el refugio no alcanza la victoria. |
| R02 · Preview | Efecto inmediato y previsión del siguiente turno con y sin la acción. El error se muestra como error, bloquea confirmar y ofrece recalcular. | Comparación de la previsión con el avance HTTP real, sin cambios de historial; pruebas de interfaz y navegador. |
| R03 · Ciencia solar | La reducción eléctrica lunar es un modo de protección simulado; la tormenta solar no tapa la luz. Definición de radiación revisada. | Textos ES/EN y evento de protección explícito. |
| R04 · Alimentos | Autonomía sin nueva cosecha y objetivo de reserva: 0.8 kg en cadete; 0.6 kg en comandante. | Objetivo presente en evaluación y prueba de planes viables en ambas dificultades. |
| R05 · Radio | 20 minutos por sentido como supuesto didáctico, respuesta a los 40 minutos leída al siguiente avance. Rango general corregido a 3–22. | Estado de respuesta pendiente, eventos y textos que explican que hay que decidir antes de esperar ante peligro. |
| R06 · Procedencia | El perfil se obtiene del bundle realmente capturado, se guarda en la partida y se reutiliza al reiniciar. | Prueba con las 139 lecturas originales; hash, algoritmo y doce intervalos consultables; rechazo de intervalos vacíos y unidades incompatibles. |
| R07 · Interfaz | Traducción semántica de evaluación y fuentes, foco contenido en las superposiciones, reservas plegables en móvil y autonomía visible. | Pruebas ES/EN, foco, recuperación de preview y recorridos móviles. |
| R08 · Varios visitantes | Identidad de visitante firmada en Next.js y autenticada ante Python con un secreto independiente. Cuotas individuales y techo global deliberado. | Pruebas de más de veinte visitantes, cuota individual, techo global y cabeceras falsas. |
| R09 · Entrega | Documentación actualizada, créditos visibles y declaración de IA; ficha en inglés y protocolo de prueba con usuarios. | Archivos de entrega revisables. La selección de licencia general y el envío formal corresponden al equipo. |
| R10 · Repetición | Comparación de resultados y acciones con el intento anterior. Modo de entrenamiento con incidentes simulados variables por semilla. | Pruebas de comparación y reproducibilidad; la secuencia radiométrica NASA no se altera. |

## Partidas anteriores y actualización

Las partidas nuevas usan reglas `lunar-1.1.0` o `mars-1.1.0`. Las versiones 1.0 conservan sus cálculos en `legacy_engine.py`; el reinicio preserva su versión y perfil. Para usar el balance nuevo, crea una misión desde el menú. Los recibos de creación del modo histórico conservan su fingerprint anterior.

En Windows, desde la carpeta del repositorio:

```powershell
git pull origin main
.\RockieOS.cmd prepare
.\RockieOS.cmd test
.\RockieOS.cmd present
```

`prepare` coordina el secreto privado del proxy entre API/.env y .env.local, conservando los otros valores. No se borra la base de partidas. En un alojamiento separado, configura MISSION_PROXY_TOKEN en Python y el mismo valor como ORBITA_PROXY_TOKEN en el servidor Next.js. Consulta la [integración](../API/docs/nextjs-integration.md).

## Validación reproducible

Las suites incluyen los casos de compatibilidad, límites, previsión, ciencia, fuentes y comparación. Un plan de recursos se comprueba para ambos destinos, dos dificultades, dos modos y tres semillas: **24 combinaciones**. Los recorridos HTTP usan datos históricos reales sin consultar NASA por red.

```powershell
.\RockieOS.cmd test
```

El flujo de GitHub Actions valida Python en Linux y Windows, SDK, proxy, frontend, compilación y navegador. Los artefactos de cada ejecución son la evidencia de esa revisión concreta. Los resultados históricos de 0.2 se conservan identificados como tales.

Quedan por ejecutar con participación del equipo: pruebas observadas con niños, dispositivos físicos, carga del alojamiento de producción, comprobación del enlace final y envío oficial. El código y los tests no se presentan como evidencia de aprendizaje ya medido.
