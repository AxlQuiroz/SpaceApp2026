# Incorporar el backend en Windows

## Copiar el paquete

Si trabajas desde el repositorio `AxlQuiroz/SpaceApp2026`, la raíz del backend es **`API/`**. Abre PowerShell allí antes de ejecutar los comandos de esta guía. `README.md` y el flujo de GitHub Actions de la raíz del repositorio quedan fuera de `API/`.

Extrae `SpaceApp2026_Backend_v0.2.0.zip`. Copia el contenido de `SpaceApp2026` dentro de tu repositorio. Si la API anterior está dentro de una carpeta `API`, puedes usar esa carpeta como raíz del backend: debe contener `README.md`, `backend-requirements.lock`, `scripts`, `services`, `sdk`, `integrations` y `docs`.

Conserva el frontend en su proyecto separado. El paquete no contiene páginas React. Si tu README ya tiene información del juego, conserva ese contenido y añade un enlace a esta guía. Combina las reglas nuevas con tu `.gitignore`; conserva los `.env` existentes.

## Instalar desde la raíz

En PowerShell, entra en la carpeta que contiene `backend-requirements.lock`. Comprueba que `py --list` muestre Python 3.12, la versión validada.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend-requirements.lock
.\.venv\Scripts\python.exe -m pip install -e services/resource-api -e services/mission-api --no-deps
.\.venv\Scripts\python.exe scripts/setup_backend.py
```

El script crea `.env` en esta raíz. Si encuentra un token válido en `services/resource-api/.env`, lo reutiliza. Si ya existe `.env` en la raíz, lo conserva: añade las opciones faltantes comparándolo con `.env.example`.

Los dos servicios deben compartir `RESOURCE_API_TOKEN`. El lanzador usa la configuración de la raíz; no carga el `.env` de la carpeta antigua. El ZIP no incluye tus tokens ni partidas.

## Probar y encender

```powershell
.\.venv\Scripts\python.exe scripts/test_backend.py
.\.venv\Scripts\python.exe scripts/run_backend.py
```

Abre <http://127.0.0.1:8000/docs>. Primera consulta:

1. Ejecuta `POST /api/v1/sessions` sin token.
2. Copia `access_token` y colócalo en **Authorize**.
3. Ejecuta `POST /api/v1/missions` con `{"data_mode":"snapshot"}`.
4. Introduce un UUID nuevo en `Idempotency-Key`; PowerShell puede generarlo con `[guid]::NewGuid().ToString()`.
5. Conserva `mission.state.id` y `mission.state.version` para las decisiones posteriores.

Swagger del puerto 8000 usa el token del jugador. El puerto 8001 conserva el token interno del servicio de recursos.

En otra terminal, desde esta raíz:

```powershell
.\.venv\Scripts\python.exe scripts/smoke_backend.py
```

Para comprobar los dos procesos con bases temporales y cierre automático:

```powershell
.\.venv\Scripts\python.exe scripts/verify_backend.py
```

No modifica tus partidas guardadas. `--live` añade descargas reales desde NASA y necesita internet. `Ctrl+C` cierra los procesos del lanzador habitual.

## Conectar el frontend

Sigue [nextjs-integration.md](nextjs-integration.md). Next.js puede ejecutarse en el puerto 3000 y este backend en el 8000. `ORBITA_API_URL` debe ser alcanzable desde el servidor Next.js; `127.0.0.1` apunta al propio equipo o contenedor donde esté ejecutándose.

El lanzador escucha sólo en `127.0.0.1`. Una instalación remota necesita un despliegue detrás de HTTPS y Uvicorn escuchando en la interfaz adecuada. Mantén el servicio 8001 accesible sólo al backend.

## Configuración

| Variable | Predeterminado | Propósito |
| --- | --- | --- |
| `RESOURCE_API_TOKEN` | Obligatoria | Secreto interno entre servicios |
| `MISSION_RESOURCE_API_URL` | `http://127.0.0.1:8001` | API de recursos |
| `MISSION_DATABASE_PATH` | `data/missions.sqlite3` | Sesiones, partidas, historial y recibos |
| `MISSION_CORS_ORIGINS` | Orígenes locales del puerto 3000 | Lista JSON de orígenes del navegador |
| `MISSION_ALLOWED_HOSTS` | `localhost`, `127.0.0.1`, `[::1]` | Lista JSON de hosts aceptados |
| `MISSION_SESSION_HOURS` | `168` | Vencimiento de las sesiones |
| `MISSION_REQUESTS_PER_MINUTE` | `300` | Límite por IP en ventanas fijas |
| `MISSION_SESSIONS_PER_HOUR` | `20` | Creación de sesiones por IP |
| `MISSION_MAX_BODY_BYTES` | `16384` | Tamaño real máximo de petición |
| `MISSION_MAX_ACTIVE_MISSIONS_PER_SESSION` | `20` | Partidas activas o pausadas |
| `MISSION_RESOURCE_TIMEOUT_SECONDS` | `60` | Tiempo máximo de respuesta interna |
| `MISSION_ALLOW_INTERNAL_HTTP` | `false` | HTTP entre contenedores de una red privada |

Las opciones de recursos siguen en su propia guía. Las listas se escriben como JSON: `MISSION_ALLOWED_HOSTS=["api.ejemplo.com"]`.

## Respaldo y Docker

Las órdenes confirmadas se guardan automáticamente. Para copiar SQLite con el servicio en uso:

```powershell
.\.venv\Scripts\python.exe scripts/backup_database.py data/missions.sqlite3 backups/missions-2026-11-14.sqlite3
```

El destino debe ser nuevo. El script usa la API de respaldo, incluye cambios confirmados en WAL y verifica integridad. Para restaurar, detén el backend y conserva los archivos actuales antes de colocar la copia en la ruta configurada. No copies únicamente el archivo principal mientras haya transacciones WAL activas.

No publiques `.env`, `data/`, respaldos ni tokens. Esta versión conserva los registros expirados; establece una política de retención al preparar el despliegue.

Con Docker Compose y `.env` ya creado:

```powershell
docker compose -f compose.backend.yaml up --build
```

Sólo se publica el puerto 8000 en la interfaz local; las bases viven en volúmenes. Se proporciona esta configuración, pero no se ejecutó durante la entrega.
