# API de partidas · v0.2.0

Servicio FastAPI independiente, con motor puro y SQLite. Consume por HTTP la API de recursos existente y ofrece su contrato al frontend Node.js/React/Next.js.

La instalación compartida y el arranque de ambos servicios se explican en el [README principal](../../README.md). Usa los comandos desde la raíz para que lean el mismo `.env`.

Para ejecutar sólo este servicio, con recursos encendido:

```powershell
.\.venv\Scripts\python.exe -m uvicorn mission_api.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

- [Contrato](../../docs/mission-api-contract.md).
- [Reglas](../../docs/simulation-rules.md).
- [Integración Next.js](../../docs/nextjs-integration.md).

La migración `src/mission_api/migrations/001_initial.sql` se aplica al abrir una base nueva. Los tokens de jugador son individuales; `RESOURCE_API_TOKEN` no autentica jugadores. Las mutaciones requieren `Idempotency-Key` y las decisiones requieren `expected_version`.
