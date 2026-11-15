# Validación de la entrega · v0.1.0

> Informe histórico de la primera API de recursos. No describe el MVP actual, que ya incluye motor, interfaz y ambas misiones. Consulta [MVP 0.4](../../docs/MVP.md) y [validación actual](../../docs/pruebas-del-proyecto.md).

Fecha: **14 de noviembre de 2026**. Entorno ejecutado: Linux, Python 3.12.14. Las instrucciones PowerShell están preparadas para Windows; no se ejecutaron en un equipo Windows.

## Pruebas automáticas

```text
python -m unittest discover -s tests -v
Ran 38 tests
OK
```

Se ejecutaron los 38 casos con HTTPX MockTransport y respuestas reales capturadas. Cubren:

- Autenticación, rechazo de tokens de ejemplo y confidencialidad de claves.
- Modelo OpenAPI, contrato de errores y validación de parámetros.
- Los cuatro tipos de evento DONKI y la llamarada X3.9 del 10 de mayo de 2024.
- Formato split de RadLab, unidades, nulos, trayectoria, valores inválidos y ventana temporal.
- Identificadores OSDR, resolución de referencias de organismos y publicaciones.
- Persistencia, paginación, expiración, tamaño máximo de caché y fallos de escritura.
- Solicitudes concurrentes idénticas y reutilización de la misma descarga.
- Reintentos, `429`, `404`, timeouts, JSON inválido, redirecciones y respuestas excesivas.
- Integridad SHA-256 y separación entre capturas históricas y modo en vivo.

## Conectividad real

Se ejecutó `scripts/smoke_live.py`, que crea la aplicación, recorre sus rutas y usa sus conectores HTTP reales. No utiliza una caché previa ni el modo de capturas.

| Consulta | Estado | Modo | Registros |
| --- | --- | --- | --- |
| DONKI FLR, 10 de mayo de 2024 | `200` | `live` | 15 |
| RadLab CRaTER, 1 de enero de 2014, 00:00–01:00 UTC | `200` | `live` | 1 |
| OSDR, estudio 104 | `200` | `live` | 1 |

Los catálogos pueden corregirse o ampliarse después de esta validación. Los resultados anteriores registran lo observado en esta fecha, no un SLA ni una promesa de disponibilidad futura.

## Ejecución HTTP y cliente del motor

Se generó configuración local, se inició Uvicorn, se comprobó `/health/ready` por HTTP y se ejecutó `examples/logic_client.py` contra el servidor. El cliente obtuvo las 15 llamaradas de la captura e identificó la X3.9. Se comprobaron también sus métodos `radiation` y `study`: una lectura y un estudio, ambos en modo `snapshot`.

El cliente conserva `records` y los metadatos de cada página. El motor de simulación no existe todavía en este repositorio: esta comprobación valida su cliente y el contrato, no reglas de juego ni partidas.

## Empaquetado

Se construyó una rueda Python con `pip wheel`, verificando la inclusión de las seis capturas y su manifiesto. No contiene `.env` ni credenciales. El contrato generado se conserva en `docs/resource-api-openapi.json`.

La configuración Docker/Compose se incluye como opción de ejecución; no fue ejecutada. La validación no incluye carga de producción, una revisión clínica/radiológica del simulador ni pruebas del frontend.
