"""Cliente HTTP interno. Nunca entrega el token de servicio al frontend."""
import asyncio
import hashlib
import json
from datetime import UTC, datetime
from typing import Literal

import httpx
from pydantic import AwareDatetime, BaseModel, Field, ValidationError

from .config import Settings
from .errors import MissionError
from .models import ScienceBundle, SourceItem


class Pagination(BaseModel):
    total: int = Field(ge=0)
    returned: int = Field(ge=0, le=1000)
    limit: int = Field(ge=1, le=1000)
    offset: int = Field(ge=0)
    has_more: bool


class Meta(BaseModel):
    model_config = {"extra": "allow"}
    provider: Literal["donki", "radlab", "osdr"]
    source_url: str
    attribution: str
    retrieval_mode: Literal["snapshot", "live", "cache", "stale_cache"]
    retrieved_at: AwareDatetime
    delivered_at: AwareDatetime
    query: dict
    warnings: list[str]
    pagination: Pagination


class Page(BaseModel):
    schema_version: Literal["1.0"]
    data: list[dict]
    meta: Meta


class ResourceClient:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def _collect(self, path: str, params: dict, provider: str):
        records, metas = [], []
        params = params | {"limit": 1000, "offset": 0, "allow_stale": True}
        identity = None
        try:
            for _ in range(10):
                async with self.client.stream("GET", path, params=params) as response:
                    if response.status_code != 200:
                        raise MissionError("RESOURCE_UNAVAILABLE", "La API de recursos no pudo responder. Comprueba que esté encendida y que comparta el token de servicio.", 503)
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > 2 * 1024 * 1024:
                            raise MissionError("RESOURCE_CONTRACT_ERROR", "La respuesta científica supera el tamaño admitido.", 502)
                page = Page.model_validate_json(body)
                p = page.meta.pagination
                current_identity = (page.meta.source_url, page.meta.retrieved_at.isoformat(), p.total,
                                    json.dumps(page.meta.query, sort_keys=True), page.meta.model_extra.get("snapshot_sha256"))
                if (page.meta.provider != provider or p.offset != params["offset"] or p.limit != params["limit"]
                        or p.returned != len(page.data)
                        or p.has_more != (p.offset + p.returned < p.total)
                        or (p.has_more and not p.returned)
                        or (identity is not None and current_identity != identity)
                        or ((params["mode"] == "snapshot") != (page.meta.retrieval_mode == "snapshot"))):
                    raise MissionError("RESOURCE_CONTRACT_ERROR", "La API de recursos devolvió una paginación inconsistente.", 502)
                identity = current_identity
                records.extend(page.data)
                metas.append(page.meta.model_dump(mode="json"))
                if not p.has_more:
                    return records, metas
                params["offset"] += p.returned
            raise MissionError("RESOURCE_CONTRACT_ERROR", "La consulta científica excede el máximo de páginas admitido.", 502)
        except (httpx.HTTPError, OSError):
            raise MissionError("RESOURCE_UNAVAILABLE", "No se pudo conectar con la API de recursos.", 503) from None
        except (ValidationError, ValueError, json.JSONDecodeError):
            raise MissionError("RESOURCE_CONTRACT_ERROR", "La respuesta científica no cumple el contrato esperado.", 502) from None

    async def capture(self, mode: str, now: datetime) -> ScienceBundle:
        weather, radiation, study = await asyncio.gather(
            self._collect("/internal/v1/space-weather", {"start": "2024-05-10", "end": "2024-05-10", "event_type": "FLR", "mode": mode}, "donki"),
            self._collect("/internal/v1/radiation", {"start": "2014-01-01T00:00:00Z", "end": "2014-01-01T01:00:00Z", "instrument": "CRaTER", "mode": mode}, "radlab"),
            self._collect("/internal/v1/studies/104", {"mode": mode}, "osdr"),
        )
        sources = [
            SourceItem(id="donki-episode", role="Contexto histórico de clima espacial", interpretation="Episodio del 10 de mayo de 2024. Su clase no se convierte en dosis ni programa una predicción real.", records=weather[0], pages_meta=weather[1]),
            SourceItem(id="radlab-reference", role="Lectura dosimétrica de referencia", interpretation="CRaTER/LRO en órbita lunar, 1 de enero de 2014; no representa la superficie ni el interior del refugio simulado.", records=radiation[0], pages_meta=radiation[1]),
            SourceItem(id="osdr-study", role="Referencia educativa sobre investigación biológica", interpretation="OSD-104 estudia ratones. No se derivan de este estudio parámetros de salud humana.", records=study[0], pages_meta=study[1]),
        ]
        canonical = json.dumps([s.model_dump(mode="json") for s in sources], sort_keys=True, separators=(",", ":"))
        return ScienceBundle(id=hashlib.sha256(canonical.encode()).hexdigest(), requested_mode=mode, captured_at=now, sources=sources)


def make_http_client(settings: Settings, transport=None) -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=settings.resource_api_url, timeout=settings.resource_timeout_seconds,
        headers={"Authorization": f"Bearer {settings.resource_api_token.get_secret_value()}", "Accept": "application/json"},
        follow_redirects=False, trust_env=False, transport=transport,
        limits=httpx.Limits(max_connections=8, max_keepalive_connections=4))
