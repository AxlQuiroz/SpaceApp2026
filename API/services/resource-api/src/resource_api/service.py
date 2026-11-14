import asyncio
import hashlib
import json
import logging
import sqlite3
from datetime import UTC, datetime
from typing import Callable

from .cache import SQLiteCache
from .config import Settings
from .errors import ResourceError
from .models import Pagination, ResourceMeta, ResourceResponse
from .providers import ResourceSpec, normalize
from .snapshot_store import SnapshotStore
from .transport import UpstreamClient

logger = logging.getLogger(__name__)


class ResourceService:
    def __init__(self, upstream: UpstreamClient, cache: SQLiteCache, snapshots: SnapshotStore,
                 settings: Settings, now: Callable[[], datetime] = lambda: datetime.now(UTC)):
        self.upstream, self.cache, self.snapshots = upstream, cache, snapshots
        self.settings, self.now = settings, now
        # Un conjunto fijo evita acumular un lock por cada consulta histórica.
        self.locks = [asyncio.Lock() for _ in range(64)]

    async def fetch(self, spec: ResourceSpec, *, mode: str | None = None, allow_stale: bool = True,
                    limit: int = 100, offset: int = 0):
        selected_mode = mode or self.settings.data_mode
        if selected_mode == "snapshot":
            raw, entry = self.snapshots.read(spec.resource, spec.query)
            data, warnings = normalize(spec, raw)
            value = {"data": data, "warnings": warnings + ["Captura histórica estática; no es una consulta en vivo."],
                     "retrieved_at": entry["retrieved_at"], "source_url": entry["source_url"]}
            return self._response(spec, value, "snapshot", limit, offset, entry)

        identity = {"schema": "1.0", "resource": spec.resource, "query": spec.query, "source": spec.source_url}
        key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
        async with self.locks[int(key[:8], 16) % len(self.locks)]:
            try:
                cached = await asyncio.to_thread(self.cache.get, key)
            except sqlite3.Error:
                cached = None
                logger.warning("resource_cache_read_failed provider=%s", spec.provider)
            now = self.now()
            age = (now.timestamp() - cached[0]) if cached else float("inf")
            if cached and 0 <= age <= self.settings.cache_ttl_seconds:
                return self._response(spec, cached[1], "cache", limit, offset)
            try:
                raw = await self.upstream.get_json(spec.provider, spec.url, spec.params)
                data, warnings = normalize(spec, raw)
            except ResourceError as exc:
                # Sólo problemas transitorios permiten servir una captura previa de la MISMA consulta.
                if (exc.transient and allow_stale and cached and age >= 0
                        and age <= self.settings.cache_ttl_seconds + self.settings.max_stale_seconds):
                    value = dict(cached[1])
                    value["warnings"] = value["warnings"] + [f"Caché vencida por fallo temporal del proveedor: {exc.code}."]
                    return self._response(spec, value, "stale_cache", limit, offset)
                raise
            fetched_at = self.now()
            value = {"data": data, "warnings": warnings, "retrieved_at": fetched_at.isoformat(), "source_url": spec.source_url}
            try:
                await asyncio.to_thread(self.cache.put, key, fetched_at.timestamp(), value)
            except sqlite3.Error:
                value["warnings"] = value["warnings"] + ["Los datos se obtuvieron, pero no pudieron guardarse en caché."]
                logger.warning("resource_cache_write_failed provider=%s", spec.provider)
            return self._response(spec, value, "live", limit, offset)

    def _response(self, spec, value, mode, limit, offset, snapshot=None):
        records = value["data"]
        page = records[offset:offset + limit]
        warnings = list(value["warnings"])
        if not records:
            warnings.append("La consulta no devolvió registros; esto no prueba la ausencia de riesgo o de fenómenos.")
        meta = ResourceMeta(provider=spec.provider, source_url=value["source_url"], attribution=spec.attribution,
            retrieval_mode=mode, retrieved_at=value["retrieved_at"], delivered_at=self.now(), query=spec.query,
            warnings=warnings, pagination=Pagination(total=len(records), returned=len(page), limit=limit,
            offset=offset, has_more=offset + len(page) < len(records)),
            snapshot_id=snapshot["id"] if snapshot else None, snapshot_sha256=snapshot["sha256"] if snapshot else None)
        return ResourceResponse(data=page, meta=meta)
