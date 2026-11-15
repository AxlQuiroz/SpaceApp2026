import asyncio
import json
import logging
import sqlite3
import time
from datetime import UTC, datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


class RequestGuard:
    """Acota el cuerpo real, asigna request_id y limita solicitudes en SQLite."""
    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        started, status = time.monotonic(), 500

        async def wrapped_send(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = list(message.get("headers", []))
                headers.extend([(b"x-request-id", request_id.encode()), (b"cache-control", b"no-store"),
                                (b"x-content-type-options", b"nosniff")])
                message = message | {"headers": headers}
            await send(message)

        async def reject(code, message, status_code, retry_after=None):
            body = json.dumps({"error": {"code": code, "message": message, "request_id": request_id}}).encode()
            headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
            if retry_after:
                headers.append((b"retry-after", str(retry_after).encode()))
            await wrapped_send({"type": "http.response.start", "status": status_code, "headers": headers})
            await wrapped_send({"type": "http.response.body", "body": body})

        try:
            if not scope["path"].startswith("/health/") and scope["method"] != "OPTIONS":
                store = scope["app"].state.store
                ip = scope.get("client", ("unknown", 0))[0]
                try:
                    retry = await asyncio.to_thread(store.rate_limit, "requests", ip, self.settings.requests_per_minute, 60, datetime.now(UTC))
                    if not retry and scope["path"] == "/api/v1/sessions" and scope["method"] == "POST":
                        retry = await asyncio.to_thread(store.rate_limit, "sessions", ip, self.settings.sessions_per_hour, 3600, datetime.now(UTC))
                except sqlite3.Error:
                    return await reject("DATABASE_UNAVAILABLE", "El almacenamiento no está disponible; vuelve a intentarlo.", 503)
                if retry:
                    return await reject("RATE_LIMITED", "Espera antes de repetir solicitudes.", 429, retry)
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > self.settings.max_body_bytes:
                    return await reject("BODY_TOO_LARGE", "El cuerpo de la petición supera el tamaño admitido.", 413)
                if not message.get("more_body", False):
                    break
            sent = False

            async def buffered_receive():
                nonlocal sent
                if not sent:
                    sent = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            await self.app(scope, buffered_receive, wrapped_send)
        finally:
            logger.info("mission_request id=%s method=%s path=%s status=%s duration_ms=%.1f",
                        request_id, scope["method"], scope["path"], status, (time.monotonic() - started) * 1000)
