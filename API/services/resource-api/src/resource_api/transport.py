import asyncio
import json
import random
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

from .config import Settings
from .errors import ResourceError

ALLOWED_HOSTS = {"ccmc.gsfc.nasa.gov", "api.nasa.gov", "visualization.osdr.nasa.gov", "osdr.nasa.gov"}


def public_url(url: str, params: dict) -> str:
    parts = urlsplit(url)
    safe = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() != "api_key"]
    safe.extend((k, str(v)) for k, v in params.items() if k.lower() != "api_key")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(safe), ""))


def reject_constant(value: str):
    raise ValueError("JSON contiene un número no finito.")


class UpstreamClient:
    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings
        self.slots = asyncio.Semaphore(4)

    async def get_json(self, provider: str, url: str, params: dict):
        if urlsplit(url).scheme != "https" or urlsplit(url).hostname not in ALLOWED_HOSTS:
            raise ResourceError("UPSTREAM_URL_BLOCKED", "La fuente no está autorizada.", provider=provider)
        async with self.slots:
            for attempt in range(self.settings.upstream_attempts):
                try:
                    async with self.client.stream("GET", url, params=params) as response:
                        status = response.status_code
                        if status == 429:
                            retry_after = self._retry_after(response.headers.get("retry-after"))
                            raise ResourceError("UPSTREAM_RATE_LIMITED", "El proveedor alcanzó su límite de consultas.",
                                                503, provider, True, retry_after)
                        if status in {500, 502, 503, 504}:
                            raise ResourceError("UPSTREAM_UNAVAILABLE", "El proveedor no está disponible temporalmente.",
                                                503, provider, True)
                        if status in {401, 403}:
                            raise ResourceError("UPSTREAM_AUTH_FAILED", "El proveedor rechazó las credenciales del servicio.", provider=provider)
                        if status == 404:
                            # No confundir una ruta retirada con una colección vacía.
                            raise ResourceError("UPSTREAM_NOT_FOUND", "El proveedor no encontró el recurso o su ruta.", provider=provider)
                        if status != 200:
                            raise ResourceError("UPSTREAM_BAD_STATUS", "El proveedor devolvió un estado inesperado.", provider=provider)
                        body = bytearray()
                        async for chunk in response.aiter_bytes():
                            body.extend(chunk)
                            if len(body) > self.settings.upstream_max_bytes:
                                raise ResourceError("UPSTREAM_RESPONSE_TOO_LARGE", "La respuesta excede el límite; reduce el intervalo.", provider=provider)
                        try:
                            # DONKI puede enviar cuerpo vacío cuando no hay eventos.
                            if not body.strip() and provider == "donki":
                                return None
                            return json.loads(body, parse_constant=reject_constant)
                        except (ValueError, UnicodeError):
                            raise ResourceError("UPSTREAM_INVALID_JSON", "El proveedor devolvió JSON inválido.", provider=provider) from None
                except httpx.TimeoutException:
                    error = ResourceError("UPSTREAM_TIMEOUT", "El proveedor no respondió a tiempo.", 504, provider, True)
                except httpx.RequestError:
                    error = ResourceError("UPSTREAM_NETWORK_ERROR", "No fue posible conectar con el proveedor.", 503, provider, True)
                except ResourceError as exc:
                    error = exc
                if not error.transient or error.code == "UPSTREAM_RATE_LIMITED" or attempt + 1 == self.settings.upstream_attempts:
                    raise error from None
                await asyncio.sleep(0.15 * (2 ** attempt) + random.uniform(0, 0.05))
        raise AssertionError("No se alcanzó un resultado de transporte.")

    @staticmethod
    def _retry_after(value: str | None) -> int:
        try:
            seconds = int(value or "60")
        except ValueError:
            try:
                seconds = int((parsedate_to_datetime(value).astimezone(UTC) - datetime.now(UTC)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                seconds = 60
        return max(1, min(seconds, 3600))
