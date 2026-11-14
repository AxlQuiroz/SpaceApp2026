# API de recursos científicos · v0.1.0

El backend que consume este servicio está implementado en `services/mission-api`. Para instalar y ejecutar ambos servicios juntos usa el [README principal](../../README.md). Esta guía conserva los comandos para ejecutar recursos de forma independiente.

Servicio independiente en **Python 3.12+ y FastAPI**, consumido por el motor de Órbita mediante HTTP. Obtiene y valida recursos NASA, los normaliza, conserva la procedencia y controla caché y fallos. La interfaz de transporte permite utilizar un motor escrito en otro lenguaje.

## Conectores disponibles

| Proveedor | Datos entregados | Uso previsto en la lógica |
| --- | --- | --- |
| DONKI | Llamaradas (FLR), eyecciones coronales (CME), partículas energéticas (SEP) y tormentas geomagnéticas (GST) | Selección de episodios y contexto de clima espacial |
| RadLab | Lecturas por instrumento, fecha y trayectoria; dosis absorbida en uGy/h y dosis equivalente en uSv/h cuando existen | Referencias dosimétricas con contexto del instrumento |
| OSDR | Metadatos de un estudio público, organismos, publicaciones y versión | Fundamento de contenido biológico y educativo |

Mars Trek y contenidos CSA están registrados como ampliaciones pendientes en el catálogo. No tienen rutas de datos implementadas en esta versión.

## Ejecutar en Windows (PowerShell)

Desde la carpeta raíz del proyecto, con Python 3.12 o posterior instalado:

```powershell
cd services/resource-api
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -m pip install -e . --no-deps
.\.venv\Scripts\python.exe scripts/setup_env.py
.\.venv\Scripts\python.exe -m uvicorn resource_api.main:create_app --factory --host 127.0.0.1 --port 8001
```

Se usa el ejecutable del entorno directamente: no hace falta activar scripts de PowerShell. Si instalaste una versión posterior, sustituye `-3.12` por tu versión.

En Linux/macOS:

```bash
cd services/resource-api
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m pip install -e . --no-deps
.venv/bin/python scripts/setup_env.py
.venv/bin/python -m uvicorn resource_api.main:create_app --factory --host 127.0.0.1 --port 8001
```

La instalación requiere internet; las capturas incluidas permiten ejecutar las consultas de demostración después sin acceso a NASA.

Abre [Swagger](http://127.0.0.1:8001/docs). En **Authorize**, pega sólo el valor `RESOURCE_API_TOKEN` de tu archivo `.env`. FastAPI añade el prefijo `Bearer`.

La configuración genera un token aleatorio. Las consultas de recursos requieren `Authorization: Bearer <token>`. El motor debe conservar ese secreto en su servidor. La configuración predeterminada de DONKI consulta directamente CCMC y no necesita una clave NASA.

## Primera consulta de demostración

En Swagger utiliza `GET /internal/v1/space-weather` con:

| Parámetro | Valor |
| --- | --- |
| start | `2024-05-10` |
| end | `2024-05-10` |
| event_type | `FLR` |
| mode | `snapshot` |

La respuesta incluye las 15 llamaradas capturadas para esa fecha, entre ellas la X3.9 del episodio usado en el prototipo. `meta.retrieval_mode` será `snapshot`, con fecha de descarga y SHA-256. Al cambiar `mode` a `live`, el servicio consultará el proveedor y después reutilizará su caché.

Las capturas sólo responden a sus consultas exactas. Usa `/internal/v1/snapshots` para ver los seis recursos incluidos:

- FLR, CME, SEP y GST del **10 de mayo de 2024**.
- CRaTER/LRO del **1 de enero de 2014, 00:00–01:00 UTC**: una lectura en órbita lunar.
- Metadatos de **OSD-104**.

## Rutas

Todas las rutas `/internal/v1` requieren el token de servicio.

| Método y ruta | Parámetros principales |
| --- | --- |
| `GET /health/live` | Estado del proceso; no consulta NASA |
| `GET /health/ready` | Disponibilidad de la caché local; no comprueba NASA |
| `GET /internal/v1/catalog` | Proveedores implementados y previstos |
| `GET /internal/v1/snapshots` | Consultas históricas disponibles, fuentes y hashes |
| `GET /internal/v1/space-weather` | `start`, `end`, `event_type=FLR\|CME\|SEP\|GST` |
| `GET /internal/v1/radiation` | `start`, `end` ISO 8601 con zona; `instrument=CRaTER` |
| `GET /internal/v1/studies/{study_id}` | ID numérico, por ejemplo `104` |
| `GET /docs` | Documentación interactiva de desarrollo |
| `GET /openapi.json` | Contrato generado por FastAPI |

Las rutas de datos aceptan además `mode=live|snapshot`, `allow_stale=true|false`, `limit` (1–1000) y `offset` (0–100000). Si no especificas `mode`, se usa `RESOURCE_DATA_MODE`.

DONKI utiliza fechas UTC inclusivas y admite hasta **31 fechas**. RadLab utiliza **[start, end)**, exige zona horaria y permite como máximo **24 horas** por consulta. La paginación ocurre después de descargar el intervalo completo; reducir `limit` no reduce el volumen pedido a NASA. Si el intervalo supera el límite de respuesta de 8 MiB, divídelo en ventanas menores. Los parámetros desconocidos se rechazan con `422`.

## Conexión con la lógica

Con el servicio ejecutándose, abre otra terminal en esta carpeta:

```powershell
.\.venv\Scripts\python.exe examples/logic_client.py
```

El cliente obtiene el episodio histórico, recorre sus páginas y conserva los metadatos de cada una. Sus métodos `space_weather`, `radiation` y `study` devuelven un `ResourceBatch` con `records` y `pages_meta`. Para solicitar información reciente, el motor puede usar `space_weather(start, end, mode="live")`.

El contrato separa dato y regla: el motor decidirá cómo un evento modifica energía, refugio, comunicaciones o actividades. La API de recursos no aplica daños, porcentajes de pérdida ni conversiones entre una clase de llamarada y la dosis de una tripulación. La [especificación](../../docs/resource-api-contract.md) describe cómo consumir las respuestas y reconocer fallos.

## Configuración

| Variable | Predeterminado | Significado |
| --- | --- | --- |
| `RESOURCE_API_TOKEN` | Obligatoria | Token aleatorio de 32 caracteres o más |
| `RESOURCE_DATA_MODE` | `live` | Modo predeterminado de consulta |
| `RESOURCE_CACHE_PATH` | `data/resources.sqlite3` | Archivo SQLite persistente |
| `RESOURCE_CACHE_TTL_SECONDS` | `300` | Tiempo de reutilización antes de refrescar |
| `RESOURCE_MAX_STALE_SECONDS` | `86400` | Antigüedad adicional admisible tras vencer el TTL |
| `RESOURCE_CACHE_MAX_ENTRIES` | `512` | Número máximo de consultas almacenadas |
| `RESOURCE_DONKI_GATEWAY` | `ccmc` | `ccmc` o `api_nasa` |
| `NASA_API_KEY` | Vacía | Obligatoria sólo con `api_nasa` |
| `RESOURCE_UPSTREAM_TIMEOUT_SECONDS` | `15` | Timeout HTTP por operación |
| `RESOURCE_UPSTREAM_ATTEMPTS` | `3` | Máximo de intentos por fallo transitorio |
| `RESOURCE_UPSTREAM_MAX_BYTES` | `8388608` | Tamaño máximo de respuesta descomprimida |

Usa CCMC de forma predeterminada: la ruta alternativa del portal `api.nasa.gov/DONKI/FLR` devolvió `404` durante la validación del 14 de noviembre de 2026. La alternativa queda configurable para instalaciones donde esté disponible.

El TTL indica cuándo repetir una descarga, no la antigüedad de la observación. Un dato de 2014 descargado hoy conserva ambas fechas. Las claves NASA no forman parte de URLs públicas, respuestas, caché ni mensajes de error.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Las pruebas automáticas utilizan respuestas reales capturadas y un transporte simulado; no consumen cuota NASA. Comprueban autenticación, contratos, unidades, consultas inválidas, concurrencia, persistencia, caché vencida, integridad de capturas, fallos y protección de credenciales.

Para probar los conectores con internet, de forma explícita:

```powershell
.\.venv\Scripts\python.exe scripts/smoke_live.py
```

Esta comprobación hace tres consultas pequeñas a fuentes NASA mediante el servicio completo. No reemplaza las pruebas automáticas. El [informe de validación](../../docs/validation.md) registra los resultados de esta entrega.

## Contenedores y ejecución remota

Opcional, con Docker Compose instalado y `.env` ya creado:

```bash
docker compose up --build
```

El puerto se publica sólo en `127.0.0.1:8001`; SQLite se conserva en un volumen. Las instrucciones para contenedores se proporcionan como configuración y no fueron ejecutadas en el entorno de entrega.

Para una instalación remota, coloca el servicio detrás de HTTPS y restringe el acceso de red al motor. No habilites CORS para exponer el token al navegador. Esta primera versión usa un token compartido y SQLite; permisos por consumidor, rotación automatizada, límites de entrada y almacenamiento distribuido requerirán trabajo antes de una operación pública de mayor escala. Los cuatro accesos simultáneos y la agrupación de consultas idénticas se aplican por proceso; no constituyen una cuota distribuida.
