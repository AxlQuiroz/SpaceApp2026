# SpaceApp2026 · Órbita — Backend v0.2.0

Backend del entrenador de decisiones y recursos para una base lunar. Incluye motor, API de partidas, guardado y conexión con recursos NASA. El frontend se desarrolla por separado con **Node.js, React y Next.js**.

| Componente | Ubicación | Función |
| --- | --- | --- |
| Recursos · puerto 8001 | `services/resource-api` | DONKI, RadLab, OSDR, caché y capturas históricas |
| Motor y partidas · puerto 8000 | `services/mission-api` | Reglas, sesiones, acciones, turnos, historial y evaluación |
| Cliente TypeScript | `sdk/typescript` | Contrato tipado para Node/React/Next.js |
| Adaptador Next.js App Router | `integrations/nextjs` | Proxy y sesión en cookie HttpOnly |

## Empezar en Windows

Abre PowerShell en **esta carpeta**, donde está `backend-requirements.lock`. Ejecuta uno por uno los siguientes comandos con Python 3.12, la versión validada para esta entrega:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend-requirements.lock
.\.venv\Scripts\python.exe -m pip install -e services/resource-api -e services/mission-api --no-deps
.\.venv\Scripts\python.exe scripts/setup_backend.py
.\.venv\Scripts\python.exe scripts/test_backend.py
.\.venv\Scripts\python.exe scripts/run_backend.py
```

No necesitas activar el entorno. Si ya tenías uno dentro de `services/resource-api`, puedes conservarlo; estos comandos crean uno compartido en la raíz. En Linux/macOS usa `python3 -m venv .venv` y `.venv/bin/python`.

- Documentación de partidas: <http://127.0.0.1:8000/docs>.
- Salud: <http://127.0.0.1:8000/health/ready>.
- Recursos internos: <http://127.0.0.1:8001/docs>.

Deja la terminal abierta; `Ctrl+C` cierra los dos procesos.

## Comprobar una misión completa

Con el backend encendido, ejecuta en otra terminal:

```powershell
.\.venv\Scripts\python.exe scripts/smoke_backend.py
```

Crea una sesión temporal, ejecuta decisiones y 12 turnos, comprueba reintentos y consulta fuentes y evaluación. Al terminar revoca esa sesión. El resultado esperado con semilla 42 es `outcome: success` y `score: 99`.

También puedes comprobar los dos procesos en bases temporales, sin iniciarlos manualmente:

```powershell
.\.venv\Scripts\python.exe scripts/verify_backend.py
```

Después de instalar dependencias, snapshot funciona sin internet. `python scripts/verify_backend.py --live` comprueba también las consultas reales de las referencias históricas a NASA.

## Documentación

- [Instalación e incorporación al proyecto](docs/backend-installation-windows.md).
- [Contrato y flujo de partidas](docs/mission-api-contract.md).
- [Conexión con Next.js/React/Node.js](docs/nextjs-integration.md).
- [Reglas y unidades](docs/simulation-rules.md).
- [Validación](docs/backend-validation.md) y [OpenAPI](docs/mission-api-openapi.json).
- [API de recursos](services/resource-api/README.md) y [fuentes científicas](docs/scientific-sources.md).

## Alcance

Una misión lunar reproducible de 24 horas, cuatro tripulantes y turnos de dos horas. Incluye dos dificultades, nueve acciones, fuga de agua, incidente solar y daño de paneles. Cada orden se guarda automáticamente. Las sesiones son anónimas y duran siete días por defecto.

Los datos NASA se conservan como referencias históricas atribuidas. Los coeficientes e incidentes son reglas didácticas versionadas: el índice de exposición **no es una dosis de radiación**. El frontend debe mostrar las fuentes y esta distinción.

Docker Compose se incluye en `compose.backend.yaml`; no se ejecutó durante la entrega. Para una instalación remota configura HTTPS, hosts permitidos, persistencia y respaldos. Esta versión usa SQLite en un servidor y no incluye cuentas con contraseña, multijugador ni un escenario marciano.
