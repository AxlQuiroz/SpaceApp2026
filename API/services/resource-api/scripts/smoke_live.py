"""Tres consultas pequeñas a NASA a través del servicio, sin servidor aparte.

Usa un token y una base de datos temporales. No imprime credenciales.
"""
import asyncio
import json
import secrets
import tempfile
from pathlib import Path

import httpx

from resource_api.config import Settings
from resource_api.main import create_app


async def main():
    with tempfile.TemporaryDirectory() as tmp:
        token = secrets.token_urlsafe(40)
        settings = Settings(api_token=token, cache_path=Path(tmp) / "smoke.db", data_mode="live", _env_file=None)
        app = create_app(settings)
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost",
                                        headers={"Authorization": f"Bearer {token}"}) as client:
                cases = [
                    ("/internal/v1/space-weather", {"start": "2024-05-10", "end": "2024-05-10"}),
                    ("/internal/v1/radiation", {"start": "2014-01-01T00:00:00Z", "end": "2014-01-01T01:00:00Z"}),
                    ("/internal/v1/studies/104", {}),
                ]
                failed = False
                for path, params in cases:
                    response = await client.get(path, params=params)
                    body = response.json()
                    result = {"path": path, "status": response.status_code}
                    if response.status_code == 200:
                        result.update(provider=body["meta"]["provider"], mode=body["meta"]["retrieval_mode"],
                                      records=body["meta"]["pagination"]["total"])
                        failed |= result["mode"] != "live" or result["records"] == 0
                    else:
                        result["error"] = body.get("error")
                        failed = True
                    print(json.dumps(result, ensure_ascii=False))
                if failed:
                    raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
