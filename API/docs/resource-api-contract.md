# Contrato de integración · recursos v1

**Consumidor:** motor del simulador. **Transporte:** HTTP/JSON. **Versión:** `/internal/v1`. **Autenticación:** Bearer de servicio. El motor y su API ya están implementados en `services/mission-api`; el contrato también permite consumidores en otros lenguajes sin modificar los conectores NASA.

## Responsabilidades

| Capa | Responsabilidad |
| --- | --- |
| Conector | Construye consultas a una fuente fija y valida su estructura |
| API de recursos | Normaliza registros, fechas y metadatos; gestiona errores, capturas y caché |
| Motor | Aplica reglas versionadas, recursos, incidentes y efectos de la misión |
| API de aplicación | Gestiona partidas, acciones, sesiones y estado en `services/mission-api` |
| Frontend externo | Node.js/React/Next.js; presenta estado y envía decisiones mediante el contrato de partidas |

## Sobre de respuesta

Todas las rutas de datos entregan `schema_version`, una lista `data` y `meta`. Incluso una consulta de estudio devuelve una lista con un elemento, para mantener el contrato. La página puede estar vacía cuando el offset supera el total.

| Campo | Interpretación |
| --- | --- |
| `schema_version` | Contrato normalizado `1.0` |
| `data` | Registros tipados del recurso solicitado |
| `meta.provider` | `donki`, `radlab` u `osdr` |
| `meta.query` | Consulta normalizada, independiente de la paginación |
| `meta.source_url` | URL de origen sin claves |
| `meta.attribution` | Entidad responsable; completar con autores/instrumento cuando corresponda |
| `meta.retrieved_at` | Momento UTC de descarga; se conserva al leer caché/capturas |
| `meta.delivered_at` | Momento UTC de esta respuesta |
| `meta.retrieval_mode` | `live`, `cache`, `stale_cache` o `snapshot` |
| `meta.pagination` | `total`, `returned`, `limit`, `offset`, `has_more` |
| `meta.warnings` | Limitaciones y transformaciones relevantes |
| `meta.snapshot_id` / `snapshot_sha256` | Identidad e integridad de la captura histórica, o `null` |

`live` significa descarga realizada durante la petición. No significa que la observación sea actual ni que se haya verificado su aplicación al escenario de la misión. `cache` reutiliza una descarga reciente de la consulta exacta. `stale_cache` reutiliza una descarga vencida tras un fallo transitorio. `snapshot` reproduce una captura estática incluida en el paquete.

El motor debe conservar los metadatos junto con los datos seleccionados. Para repetir una misión de forma idéntica, guarda los registros utilizados, sus fuentes y fechas, la versión de reglas y la semilla del motor. La caché HTTP por sí sola no congela una partida ni garantiza consistencia entre páginas si expira durante la lectura.

## Registros

**DONKI:** `source_id`, `source_url`, `event_type`, `observed_at`, `peak_at`, `end_at`, `classification`, `solar_source_location`, `instruments`, `linked_event_ids` y `details`.

`classification` contiene la clase de llamarada cuando existe (por ejemplo, `X3.9`). Las coordenadas de la región solar son `solar_source_location`; no representan la ubicación de la base. `details` conserva el registro original, incluidos los análisis de CME y observaciones Kp de GST. Los cambios de estructura del proveedor no se convierten en una colección vacía.

**RadLab:** `source_id`, `source_url`, `observed_at`, `instrument_id`, `celestial_body`, `spacecraft`, `trajectory` y `measurements`.

Cada medición contiene `quantity`, `value` y `unit`:

| quantity | unit | Magnitud |
| --- | --- | --- |
| `absorbed_dose_rate` | `uGy/h` | Dosis absorbida por hora |
| `dose_equivalent_rate` | `uSv/h` | Dosis equivalente por hora |

`uGy/h` y `uSv/h` usan `u` ASCII para micro (µ). Un dato faltante se omite de la lista de mediciones; no se sustituye por cero. `measurements=[]` indica que una fila no aporta esas magnitudes. La API no realiza conversiones entre ambas. Los timestamps de RadLab que vienen sin zona se interpretan como UTC y generan una advertencia explícita. Instrumentos, trayectorias o valores inválidos producen un error de estructura.

**OSDR:** `source_id`, `source_url`, `title`, `description`, `version`, `public_release_date`, `organisms` y `publications`. El identificador de la respuesta debe coincidir con el solicitado. Las categorías referenciadas por `@id` se resuelven para obtener organismos del formato ISA. El contenido procede de los metadatos; no implica una evaluación científica de los resultados ni de su aplicabilidad a humanos.

## Fallos

Ejemplo de error temporal:

```json
{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "El proveedor no respondió a tiempo.",
    "provider": "donki",
    "request_id": "identificador de seguimiento"
  }
}
```

| HTTP | Códigos principales | Acción del consumidor |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Revisar token del servicio |
| `404` | `RESOURCE_NOT_FOUND`, `SNAPSHOT_NOT_FOUND` | Corregir estudio o usar una captura disponible |
| `422` | `INVALID_REQUEST` | Corregir fechas, parámetros o límites |
| `502` | `UPSTREAM_SCHEMA_CHANGED`, `UPSTREAM_INVALID_JSON`, `UPSTREAM_AUTH_FAILED`, `UPSTREAM_NOT_FOUND`, `UPSTREAM_RESPONSE_TOO_LARGE`, `UPSTREAM_BAD_STATUS` | Revisar integración; reducir intervalo si excede tamaño |
| `503` | `UPSTREAM_UNAVAILABLE`, `UPSTREAM_NETWORK_ERROR`, `UPSTREAM_RATE_LIMITED` | Esperar; respetar `Retry-After` si está presente |
| `504` | `UPSTREAM_TIMEOUT` | Reintentar más tarde |
| `500` | `SNAPSHOT_INTEGRITY_FAILED`, `INTERNAL_ERROR` | Revisar instalación o incidente del servicio |

Los errores de validación añaden `details` con campo, tipo y mensaje, excluyendo los valores de entrada. Cada respuesta incluye `X-Request-ID`; el motor debe registrarlo al reportar un fallo.

## Reglas de caché y disponibilidad

- Se almacena el resultado normalizado del intervalo completo; distintos offsets reutilizan la misma descarga.
- La identidad incluye recurso, parámetros, origen y versión de contrato; no incluye claves.
- El servicio realiza hasta tres intentos para problemas de red, timeout y estados `500/502/503/504` del proveedor.
- `429` no se reintenta dentro de la petición. Su `Retry-After` admite segundos o fecha HTTP y se acota entre 1 y 3600 segundos.
- Sólo fallos transitorios permiten usar caché vencida de la misma consulta y dentro del límite configurado. Usa `allow_stale=false` para exigir refresco una vez vencido el TTL.
- Los fallos de autenticación, formato, estructura, ruta o integridad no se ocultan con caché vencida.
- No se pasa automáticamente de modo `live` a una captura histórica. El consumidor debe elegirla explícitamente o configurar el modo predeterminado del servicio.
- Una consulta válida sin registros devuelve `200` con `data=[]` y advertencia; una caída del proveedor devuelve error si no hay caché admisible.

## Añadir otro conector

Define la consulta validada, un `ResourceSpec` con host fijo, su normalizador, modelo de salida y ruta tipada. Registra el proveedor en el catálogo, añade el dominio oficial a la lista de transporte, conserva atribución y añade pruebas de contrato y fallos con una captura real. Los efectos de juego permanecen en el motor.
