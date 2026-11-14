# Validación del backend v0.2.0

Fecha: **14 de noviembre de 2026**. Entorno comprobado: Python 3.12.14, FastAPI 0.141.1, HTTPX 0.28.1 y Pydantic 2.13.4. Integración: Node.js 24.22.1, Next.js 16.4.6, React 19.3.1 y TypeScript 7.0.2.

## Pruebas automáticas

| Grupo | Pruebas | Resultado |
| --- | --- | --- |
| API de recursos NASA existente | 38 | Aprobadas |
| Motor de simulación | 20 | Aprobadas |
| API de partidas, sesiones y concurrencia | 27 | Aprobadas |
| Cliente interno de recursos y consistencia de páginas | 9 | Aprobadas |
| SDK TypeScript | 6 | Aprobadas |
| Adaptador Next.js con NextRequest/NextResponse reales | 11 | Aprobadas |
| **Total** | **111** | **Aprobadas** |

La comprobación de tipos de SDK, ejemplos y Route Handler pasó en modo estricto. Los tipos de salida incluyen los valores que el backend siempre serializa, mientras que los parámetros predeterminados de creación permanecen opcionales en las entradas.

Cobertura funcional: balance de recursos y prioridad eléctrica; producción limitada por energía y agua; transferencias finitas; reparaciones; refugio; repetibilidad por semilla; victoria y fracaso; pausa y abandono; aislamiento entre jugadores; vencimiento y revocación; guardado tras reiniciar el proceso; recibos persistentes; concurrencia; previsualización sin escritura; paginación; límites reales de cuerpo y frecuencia; CORS para Next.js; errores sin secretos; fallos de proveedores sin sustitución silenciosa; coherencia de referencias entre páginas.

## Recorridos con procesos reales

`scripts/verify_backend.py` inicia dos procesos Uvicorn con bases temporales y comprueba el flujo HTTP completo. Los informes conservados no incluyen tokens:

| Recorrido | Resultado | Evidencia |
| --- | --- | --- |
| API de partidas → recursos → capturas históricas | 12 turnos, success, 99 puntos | [smoke-snapshot.json](validation-backend/smoke-snapshot.json) |
| API de partidas → recursos → NASA por red | 12 turnos, success, 99 puntos | [smoke-live.json](validation-backend/smoke-live.json) |
| Route Handler Next.js → API de partidas → recursos | 12 turnos, success, 99 puntos; cookie HttpOnly | [smoke-nextjs.json](validation-backend/smoke-nextjs.json) |

Las consultas reales devolvieron 15 llamaradas DONKI del 10 de mayo de 2024, una lectura CRaTER/LRO del 1 de enero de 2014 y un estudio OSDR. Las tres respuestas indicaron `retrieval_mode: live` durante la comprobación. Esas fechas siguen siendo históricas y no representan observaciones simultáneas de una base lunar.

El recorrido Next.js comprueba creación y reutilización de sesión, token fuera del JSON del navegador, decisiones y sus reintentos con igual UUID, avance completo, fuentes, evaluación y cierre de sesión. Se ejecutó el Route Handler contra Python; no una interfaz de usuario completa.

También se verificó el script de respaldo con una conexión SQLite abierta en WAL, una transacción confirmada y lectura coherente de la copia.

## Reproducir

Desde la raíz del backend, con dependencias instaladas:

```bash
python scripts/test_backend.py
node --experimental-strip-types --test sdk/typescript/tests/client.test.ts
python scripts/export_contracts.py
```

En `integrations/nextjs`:

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
```

De vuelta en la raíz:

```bash
python scripts/verify_backend.py --live --nextjs
```

Quita `--live` para no consultar NASA; quita `--nextjs` si sólo instalaste Python. La verificación con bases temporales no modifica las partidas de la instalación habitual.

## Límites de la validación

- No se ejecutó Docker, un instalador ni una prueba de carga de producción.
- La interfaz externa no estaba en este repositorio; no se compiló ni se verificó su presentación visual.
- Los comandos de Windows se prepararon para PowerShell; la ejecución de esta validación fue en Linux.
- El balance y los efectos se verifican respecto del modelo didáctico documentado, no frente a un modelo físico o clínico certificado.
- Las consultas NASA fueron exitosas en esta comprobación; la disponibilidad futura depende de cada proveedor.

El backend funcional de esta entrega comprende una misión lunar individual, sesiones anónimas y SQLite en un servidor. Cuentas, multijugador, Marte y escalado distribuido corresponden a ampliaciones con requisitos propios.
