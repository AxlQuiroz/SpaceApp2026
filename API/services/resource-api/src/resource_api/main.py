import asyncio
import logging
import secrets
import time
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, Path, Query, Request, Security
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import __version__
from .cache import SQLiteCache
from .config import Settings
from .errors import ResourceError
from .models import (ErrorResponse, QueryBase, RadiationQuery, RadiationReading, ResourceResponse,
                     SpaceWeatherEvent, Study, WeatherQuery)
from .providers import radiation_spec, study_spec, weather_spec
from .service import ResourceService
from .snapshot_store import SnapshotStore
from .transport import UpstreamClient

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False, scheme_name="ServiceToken", description="Token privado de la lógica del simulador.")


def create_app(settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
        cache = await asyncio.to_thread(SQLiteCache, settings.cache_path, settings.cache_max_entries)
        async with httpx.AsyncClient(transport=transport, follow_redirects=False,
                timeout=httpx.Timeout(settings.upstream_timeout_seconds, connect=5),
                limits=httpx.Limits(max_connections=4, max_keepalive_connections=4),
                headers={"User-Agent": f"Orbita-Resource-API/{__version__}", "Accept": "application/json"}) as client:
            app.state.resources = ResourceService(UpstreamClient(client, settings), cache, SnapshotStore(), settings)
            yield

    app = FastAPI(title="Órbita — API de recursos científicos", version=__version__, lifespan=lifespan,
        description="API interna para el motor del simulador. Fechas UTC, unidades y procedencia explícitas. No aplica reglas del juego.")

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = str(uuid4())
        started = time.monotonic()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        # No registrar query, cabeceras ni cuerpos.
        logger.info("resource_request id=%s method=%s path=%s status=%s duration_ms=%.1f",
                    request.state.request_id, request.method, request.url.path, response.status_code,
                    (time.monotonic() - started) * 1000)
        return response

    @app.exception_handler(ResourceError)
    async def resource_error(request: Request, exc: ResourceError):
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else {}
        if exc.status == 401:
            headers["WWW-Authenticate"] = "Bearer"
        return JSONResponse(status_code=exc.status, headers=headers, content={"error": {
            "code": exc.code, "message": exc.message, "provider": exc.provider, "request_id": request.state.request_id}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Excluir 'input' y 'ctx': pueden contener valores sensibles.
        details = [{"field": ".".join(map(str, e["loc"])), "message": e["msg"], "type": e["type"]} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"error": {"code": "INVALID_REQUEST",
            "message": "Revisa los parámetros de la consulta.", "details": details, "request_id": request.state.request_id}})

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.error("resource_internal_error id=%s type=%s", request.state.request_id, type(exc).__name__)
        return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR",
            "message": "El servicio no pudo completar la consulta.", "request_id": request.state.request_id}},
            headers={"X-Request-ID": request.state.request_id, "Cache-Control": "no-store"})

    async def require_service_token(credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)]):
        if credentials is None or not secrets.compare_digest(credentials.credentials.encode(), settings.api_token.get_secret_value().encode()):
            raise ResourceError("UNAUTHORIZED", "Se requiere un token de servicio válido.", 401)

    protected = [Depends(require_service_token)]
    resource_errors = {status: {"model": ErrorResponse} for status in (401, 404, 422, 500, 502, 503, 504)}

    @app.get("/health/live", tags=["health"])
    async def live():
        return {"status": "ok", "service": "orbita-resource-api", "version": __version__}

    @app.get("/health/ready", tags=["health"])
    async def ready(request: Request):
        ok = await asyncio.to_thread(request.app.state.resources.cache.ready)
        return JSONResponse(status_code=200 if ok else 503, content={"status": "ready" if ok else "not_ready"})

    @app.get("/internal/v1/catalog", dependencies=protected, tags=["catalog"])
    async def catalog():
        return {"schema_version": "1.0", "resources": [
            {"provider": "donki", "status": "implemented", "resource": "space-weather", "event_types": ["FLR", "CME", "SEP", "GST"], "source": "https://ccmc.gsfc.nasa.gov/tools/DONKI/"},
            {"provider": "radlab", "status": "implemented", "resource": "radiation", "source": "https://visualization.osdr.nasa.gov/radlab/gui/data-api/"},
            {"provider": "osdr", "status": "implemented", "resource": "studies", "source": "https://api.nasa.gov/#osdr"},
            {"provider": "mars_trek", "status": "planned", "resource": "terrain"},
            {"provider": "csa", "status": "planned", "resource": "educational-content"}]}

    @app.get("/internal/v1/snapshots", dependencies=protected, tags=["catalog"])
    async def snapshots(request: Request):
        return {"schema_version": "1.0", "snapshots": request.app.state.resources.snapshots.catalog()}

    @app.get("/internal/v1/space-weather", dependencies=protected, response_model=ResourceResponse[SpaceWeatherEvent], responses=resource_errors, tags=["resources"])
    async def weather(request: Request, query: Annotated[WeatherQuery, Query()]):
        """Eventos DONKI. start y end son fechas UTC inclusivas, hasta 31 fechas."""
        return await request.app.state.resources.fetch(weather_spec(query, settings), mode=query.mode,
            allow_stale=query.allow_stale, limit=query.limit, offset=query.offset)

    @app.get("/internal/v1/radiation", dependencies=protected, response_model=ResourceResponse[RadiationReading], responses=resource_errors, tags=["resources"])
    async def radiation(request: Request, query: Annotated[RadiationQuery, Query()]):
        """Mediciones RadLab. Intervalo [start, end), zona horaria obligatoria, máximo 24 h."""
        return await request.app.state.resources.fetch(radiation_spec(query), mode=query.mode,
            allow_stale=query.allow_stale, limit=query.limit, offset=query.offset)

    @app.get("/internal/v1/studies/{study_id}", dependencies=protected, response_model=ResourceResponse[Study], responses=resource_errors, tags=["resources"])
    async def study(request: Request, study_id: Annotated[int, Path(ge=1, le=999999)], query: Annotated[QueryBase, Query()]):
        """Metadatos de un estudio público OSDR por número de acceso."""
        return await request.app.state.resources.fetch(study_spec(study_id), mode=query.mode,
            allow_stale=query.allow_stale, limit=query.limit, offset=query.offset)

    return app
