# Pruebas y recuperación de RockieOS

El alcance funcional incluye misiones individuales en la Luna y Marte: sesión anónima, dificultad, decisiones, recursos, incidentes, refugio, reparaciones, pausa, reanudación, guardado, evaluación y reinicio. Marte añade comunicación con la Tierra, radiación de Curiosity y tormenta de polvo. La pantalla real usa el backend Python; `?demo=1` utiliza un simulador local para previsualizar el diseño.

## Ejecutar todo desde un menú

Abre `RockieOS.cmd` en la raíz. La opción **1** prepara las dependencias, **2** inicia la presentación y **5** ejecuta las pruebas completas. La opción **4** omite compilación y navegador. Ambas modalidades de pruebas completan misiones de Luna y Marte. Cada ejecución deja un informe HTML y registros en `reports/rockieos/`; la opción **7** abre el último.

En PowerShell también puedes ejecutar ` .\RockieOS.cmd test` o ` .\RockieOS.cmd present`. Consulta la [guía del lanzador](lanzador-windows.md) para requisitos, cierre y diagnóstico. Las instrucciones manuales siguen disponibles abajo.

## Actualizar e iniciar en Windows

Requisitos: Python 3.12 y Node.js 24. Desde la raíz del repositorio, instala el frontend con `npm.cmd ci`. En `API/`, instala las dependencias como indica su README. Conserva tus archivos `.env` y `.env.local`.

Primera terminal, dentro de `API/`:

```powershell
.\.venv\Scripts\python.exe scripts/setup_backend.py
.\.venv\Scripts\python.exe scripts/verify_snapshots.py --repair
.\.venv\Scripts\python.exe scripts/run_backend.py
```

Segunda terminal, en la raíz del repositorio:

```powershell
npm.cmd ci
if (-not (Test-Path .env.local)) { Copy-Item .env.local.example .env.local }
npm.cmd run dev
```

Abre `http://localhost:3000/mision`. El menú muestra las misiones asociadas a la sesión actual; selecciona una para continuar o crea una nueva. Salir al menú no elimina la partida. La pausa impide avanzar hasta reanudarla.

## Comprobaciones del frontend

Desde la raíz:

```powershell
npm.cmd run check:contracts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

`check:contracts` detecta diferencias entre el SDK, esquema o proxy de la interfaz y sus equivalentes en `API/`. Las pruebas unitarias cubren errores temporales, referencias inexistentes, UUID de creación/órdenes/reinicio, concurrencia de clics, evaluación, recarga de órdenes pendientes, límites de frecuencia y cierre de modales.

## Comprobaciones de Python y del SDK

Desde `API/`:

```powershell
.\.venv\Scripts\python.exe scripts/test_backend.py
.\.venv\Scripts\python.exe scripts/verify_snapshots.py
.\.venv\Scripts\python.exe scripts/verify_backend.py
.\.venv\Scripts\python.exe scripts/verify_backend.py --scenario all
.\.venv\Scripts\python.exe scripts/export_contracts.py --check
node --experimental-strip-types --test sdk/typescript/tests/client.test.ts
```

Las pruebas de integridad comprueban los bytes reales del checkout. `verify_backend.py` usa bases temporales y cierra sus procesos al terminar. `--live` añade consultas por red a las referencias históricas de NASA.

## Navegador: escritorio y móvil

Después de instalar Python y compilar el frontend, desde la raíz:

```powershell
npm.cmd exec playwright install chromium
npm.cmd run test:e2e
```

Las pruebas levantan el frontend en el puerto 3100 y los servicios temporales en 8700/8701. Esos puertos deben estar libres. El lanzador busca `API/.venv`, o usa Python del sistema; también admite `PYTHON_EXECUTABLE` con la ruta de tu intérprete. No modifica `.env` ni las partidas habituales.

Se comprueban misiones completas de Luna y Marte, fuentes científicas, pausa/reanudación, recarga, final de misión, reinicio con error temporal y reintentos tras errores 503. Se ejecutan en Chromium con resoluciones de escritorio y móvil. El informe queda en `playwright-report/`; las capturas y trazas, en `test-results/`. GitHub Actions conserva ambos como artefacto `pruebas-navegador` y prueba el lanzador completo de Windows, incluso desde una carpeta con espacios.

## Recuperación de conexión

- Si falla la restauración con un error temporal, la referencia de la partida permanece guardada. Reintenta la conexión.
- Si una decisión recibe un error temporal, pulsa Reintentar. Se conserva la misma clave y el mismo cuerpo; no se repite como una intención nueva.
- Si se confirmó una orden pero falló la evaluación o sincronización, se reintentan las lecturas.
- Las órdenes pendientes se guardan en `sessionStorage`, sin tokens. Al recargar la misma pestaña se recuperan únicamente si sigue siendo la misma sesión.
- Un límite de frecuencia respeta `Retry-After`. El botón indica el tiempo de espera.
- Un 404 confirmado permite descartar una referencia local que ya no pertenece a la sesión. Un 503 no la elimina.

## Capturas en Windows

Para un clon anterior donde la conversión CRLF ya ocurrió, desde `API/`:

```powershell
.\.venv\Scripts\python.exe scripts/verify_snapshots.py --repair
```

El comando sólo escribe cuando normalizar CRLF recupera exactamente el SHA-256 del manifiesto. No inventa registros ni acepta cambios de contenido. El lanzador habitual hace esta misma comprobación antes de iniciar los servicios.

## Límites

Las pruebas de navegador usan emulación de móvil, no un dispositivo Android o iOS físico. Las reglas siguen siendo un modelo didáctico y las fuentes son históricas atribuidas. SQLite corresponde a una instalación en un servidor; la publicación remota requiere la configuración HTTPS y de persistencia descrita en las guías del backend. Las sesiones anónimas expiradas no tienen recuperación por correo.


## Regresiones de decisiones y fuentes (0.3)

El inventario incluye **219 pruebas** entre Python (125), SDK (9), adaptador Next.js (12), interfaz (39), lanzador (12) y navegador escritorio/móvil (22). El resultado de la ejecución concreta se consulta en GitHub Actions y en los informes del lanzador.

Los casos nuevos comprueban informes científicos sin datos/repetidos, reserva alimentaria, previsión frente al avance real, recuperación de preview fallido, foco, fuentes en inglés, perfil derivado de las 139 lecturas, conservación de reglas 1.0, recibos pendientes anteriores, comparación de intentos y más de veinte visitantes detrás de un proxy autenticado. El plan viable se ejercita en 24 combinaciones de escenario, dificultad, modo y semilla.

Para evaluar comprensión humana, usa [prueba-con-usuarios.md](prueba-con-usuarios.md). Para publicar en un alojamiento separado, configura los secretos privados descritos en [integración Next.js](../API/docs/nextjs-integration.md).

El pulido de la consola añade recorridos de estado de los interruptores, motivos de bloqueo, tutorial y teclado en familias/vestidor. Las capturas de la pantalla principal y la consola quedan en los artefactos de navegador. El ensayo de entrega se describe en [guion-presentacion.md](guion-presentacion.md).
