# API de partidas · v0.2.0

Base local: `http://127.0.0.1:8000`; prefijo `/api/v1`. [OpenAPI](mission-api-openapi.json). JSON UTF-8 y fechas UTC ISO 8601. Partidas y claves de idempotencia usan UUID.

## Rutas

| Método y ruta | Acceso | Función |
| --- | --- | --- |
| `GET /health/live` | Público | Estado del proceso |
| `GET /health/ready` | Público | Base disponible; no comprueba NASA |
| `POST /api/v1/sessions` | Público, limitado | Crear sesión anónima |
| `GET /api/v1/sessions/me` | Sesión | Identidad y vencimiento |
| `DELETE /api/v1/sessions/current` | Sesión | Revocar sesión; responde 204 |
| `GET /api/v1/scenarios` | Público | Catálogo, tutorial y reglas |
| `GET /api/v1/scenarios/{scenario_id}` | Público | Escenario por identificador |
| `POST /api/v1/missions` | Sesión + clave | Crear misión y congelar referencias |
| `GET /api/v1/missions` | Sesión | Listar propias con `limit`, `offset` |
| `GET /api/v1/missions/{id}` | Sesión | Estado, alertas y acciones |
| `POST /api/v1/missions/{id}/commands` | Sesión + clave | Acción, avance, pausa, reanudación o abandono |
| `POST /api/v1/missions/{id}/preview` | Sesión | Previsualizar sin guardar |
| `POST /api/v1/missions/{id}/restart` | Sesión + clave | Nueva misión, igual semilla y referencias |
| `GET /api/v1/missions/{id}/events` | Sesión | Historial paginado ascendente |
| `GET /api/v1/missions/{id}/science` | Sesión | Registros, fechas, atribución y contexto |
| `GET /api/v1/missions/{id}/evaluation` | Sesión | Evaluación provisional o final |

## Autenticación y propiedad

`POST /sessions` devuelve `session_id`, `access_token`, `token_type`, `created_at` y `expires_at`. No pide nombre, correo ni contraseña. El token sólo se entrega en esa respuesta; envíalo como `Authorization: Bearer <access_token>`. SQLite guarda su SHA-256. Las sesiones expiradas o revocadas reciben 401.

`RESOURCE_API_TOKEN` permanece en el backend y no autentica jugadores. Las partidas ajenas responden 404 tanto en lecturas como en mutaciones; no se acepta un propietario enviado por el cliente. Las sesiones anónimas no tienen recuperación por correo ni sincronización entre dispositivos: conserva la cookie o el token. Revocar una sesión no elimina sus partidas.

## Creación

```http
POST /api/v1/missions
Authorization: Bearer <player-token>
Idempotency-Key: 6eed4211-2992-49a4-b309-f19218fc861c
Content-Type: application/json
```

```json
{"scenario_id":"lunar-outpost-v1","difficulty":"cadet","seed":42,"data_mode":"snapshot"}
```

Los campos tienen valores predeterminados; `{}` es válido. Dificultad: `cadet` o `commander`. Semilla: entero entre 0 y 2147483647. La respuesta 201 contiene `mission.state`, `mission.available_actions`, `mission.alerts` y `events`.

`snapshot` utiliza las capturas mediante la API de recursos, que debe estar encendida. `live` descarga las mismas fechas históricas y puede reutilizar caché, conservando el modo real en los metadatos. **Live no significa observaciones actuales de la base.** No se sustituye silenciosamente una descarga fallida por una captura.

Las referencias quedan guardadas al crear la misión. Las órdenes siguientes y restart no consultan de nuevo NASA. Si falta un proveedor durante la creación, se devuelve 503 sin guardar una misión incompleta.

## Decisiones y concurrencia

```json
{"type":"action","action_id":"explore","expected_version":1}
```

Para avanzar: `{"type":"advance","expected_version":2}`. También existen `pause`, `resume` y `abort`. `action_id` sólo se permite para `type=action`.

Cada orden confirmada incrementa `state.version`. Dos órdenes distintas sobre la misma versión no se ejecutan ambas: una recibe `409 VERSION_CONFLICT`. Consulta el estado y permite reevaluar la decisión. Estado, historial y recibo se confirman en una misma transacción. `ETag` informa la versión; las escrituras se controlan con `expected_version`, no con `If-Match`.

## Reintentos

Genera una `Idempotency-Key` nueva por intención. Tras una desconexión repite **ruta, clave y cuerpo idénticos**, incluida la versión. Se devuelve la respuesta original sin gastar recursos ni avanzar otra vez. La misma clave con otro cuerpo devuelve `409 IDEMPOTENCY_CONFLICT`. Los recibos sobreviven a reinicios del proceso.

Un recibo puede corresponder a un estado anterior: consulta el estado actual si otras decisiones pudieron ejecutarse entretanto. Una solicitud rechazada no consume la clave de la partida. Creación, decisiones y reinicio tienen ámbitos independientes por jugador y ruta.

## Preview, reinicio y estados

Preview recibe `action_id` y `expected_version`; devuelve `persisted:false`, `based_on_version` y un resultado hipotético. Su versión no es la guardada. Restart recibe `expected_version` y una clave, crea otro identificador con `parent_mission_id` y conserva la misión anterior. La nueva ocupa otro espacio en el límite de partidas activas.

Estados: `active`, `paused`, `completed`, `failed`, `aborted`. El reloj sólo avanza con `advance`; cerrar el navegador no consume recursos. Las misiones terminadas mantienen su evaluación y rechazan más órdenes.

El frontend utiliza `available_actions`, `enabled`, `disabled_reason` y los costes para sus controles. El backend los valida de nuevo. Los catálogos muestran las reglas y unidades.

## Errores

```json
{"error":{"code":"VERSION_CONFLICT","message":"La partida cambió. Consulta su estado y vuelve a evaluar la decisión.","request_id":"..."}}
```

| HTTP | Códigos principales |
| --- | --- |
| 401 | `UNAUTHORIZED` |
| 404 | `MISSION_NOT_FOUND`, `SCENARIO_NOT_FOUND`, `NOT_FOUND` |
| 409 | `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `ACTION_UNAVAILABLE`, `MISSION_PAUSED`, `MISSION_FINISHED`, `MISSION_LIMIT`, `INVALID_STATE` |
| 413 / 422 | `BODY_TOO_LARGE` / `INVALID_REQUEST` |
| 429 | `RATE_LIMITED`, con `Retry-After` |
| 502 | `RESOURCE_CONTRACT_ERROR` |
| 503 | `RESOURCE_UNAVAILABLE`, `DATABASE_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` |

`X-Request-ID` permite correlacionar la petición sin registrar tokens o cuerpos. Los errores de validación omiten los valores recibidos. Los límites se comparten entre procesos que usan la misma base; no son cuotas distribuidas entre servidores. Detrás de Next.js, los jugadores pueden compartir la IP del servidor: ajusta el límite al despliegue.
