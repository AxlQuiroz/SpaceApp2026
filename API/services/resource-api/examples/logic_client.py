"""Cliente para la futura lógica. Ejecutar desde services/resource-api.

El cliente obtiene datos; el motor decidirá su efecto en recursos o tripulación.
"""
import asyncio
import os
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv


@dataclass
class ResourceBatch:
    records: list[dict[str, Any]]
    pages_meta: list[dict[str, Any]]


@dataclass
class ResourceClient:
    base_url: str
    token: str

    def __post_init__(self):
        url = urlsplit(self.base_url)
        if url.scheme != "https" and not (url.scheme == "http" and url.hostname in {"127.0.0.1", "localhost", "::1"}):
            raise ValueError("La conexión remota al servicio requiere HTTPS.")

    async def space_weather(self, start: str, end: str, event_type: str = "FLR", mode: str = "live", allow_stale: bool = True) -> ResourceBatch:
        return await self._collect("/internal/v1/space-weather", {
            "start": start, "end": end, "event_type": event_type, "mode": mode, "allow_stale": allow_stale})

    async def radiation(self, start: str, end: str, instrument: str = "CRaTER", mode: str = "live", allow_stale: bool = True) -> ResourceBatch:
        return await self._collect("/internal/v1/radiation", {
            "start": start, "end": end, "instrument": instrument, "mode": mode, "allow_stale": allow_stale})

    async def study(self, study_id: int, mode: str = "live", allow_stale: bool = True) -> ResourceBatch:
        return await self._collect(f"/internal/v1/studies/{study_id}", {"mode": mode, "allow_stale": allow_stale})

    async def _collect(self, path: str, query: dict) -> ResourceBatch:
        """Conserva los metadatos de CADA página, incluidos avisos de caché vencida."""
        params = query | {"limit": 1000, "offset": 0}
        async with httpx.AsyncClient(base_url=self.base_url, timeout=55,
                                    headers={"Authorization": f"Bearer {self.token}"}) as client:
            data, metadata = [], []
            while True:
                response = await client.get(path, params=params)
                response.raise_for_status()
                page = response.json()
                if page["schema_version"] != "1.0":
                    raise ValueError("El cliente no admite esta versión del contrato.")
                data.extend(page["data"])
                metadata.append(page["meta"])
                if not page["meta"]["pagination"]["has_more"]:
                    break
                returned = page["meta"]["pagination"]["returned"]
                if returned < 1:
                    raise ValueError("La paginación del servicio no avanza.")
                params["offset"] += returned
            return ResourceBatch(records=data, pages_meta=metadata)


async def main():
    load_dotenv()
    client = ResourceClient(os.getenv("RESOURCE_API_URL", "http://127.0.0.1:8001"), os.environ["RESOURCE_API_TOKEN"])
    result = await client.space_weather("2024-05-10", "2024-05-10", mode="snapshot")
    print("Modo:", result.pages_meta[0]["retrieval_mode"])
    for event in result.records:
        print(event["source_id"], event["classification"], event["observed_at"])
    # El futuro motor puede traducir estos eventos mediante reglas versionadas.
    # Esta API no asigna porcentajes de pérdida, daños ni dosis por clase de llamarada.


if __name__ == "__main__":
    asyncio.run(main())
