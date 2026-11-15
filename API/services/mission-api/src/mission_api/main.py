import asyncio
import logging
import sqlite3
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, Query, Request, Response, Security
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import Field
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

from . import __version__
from .config import Settings
from .engine import transition, view
from .errors import MissionError
from .middleware import RequestGuard
from .models import (Command, CreateMission, ErrorResponse, Evaluation, ForecastComparison, EventList, MissionList,
                     MissionView, Model, MutationResult, Preview, PreviewResult, RestartMission,
                     ScienceBundle, SessionCreated, SessionInfo)
from .resources import ResourceClient, make_http_client
from .rules import RULESETS, scenario_catalog
from .storage import Store, fingerprint

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False, scheme_name="PlayerSession", description="Token individual devuelto al crear una sesión; nunca uses RESOURCE_API_TOKEN.")


class PageQuery(Model):
    limit: Annotated[int, Field(ge=1, le=100)] = 20
    offset: Annotated[int, Field(ge=0, le=100000)] = 0


def create_app(settings: Settings | None = None, resource_transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
        app.state.store = await asyncio.to_thread(Store, settings.database_path, settings.max_active_missions_per_session)
        async with make_http_client(settings, resource_transport) as client:
            app.state.resources = ResourceClient(client)
            yield

    app = FastAPI(title="RockieOS — Backend de misiones", version=__version__, lifespan=lifespan,
        description="Motor lunar y API para Next.js/React. Partidas aisladas, reglas versionadas y fuentes históricas atribuidas.",
        responses={code: {"model": ErrorResponse} for code in [401, 404, 409, 413, 422, 429, 500, 502, 503]})
    app.add_middleware(RequestGuard, settings=settings)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        expose_headers=["X-Request-ID", "ETag", "Retry-After"], max_age=600)

    def error_response(request, code, message, status, details=None):
        request_id = getattr(request.state, "request_id", "unavailable")
        content = {"code": code, "message": message, "request_id": request_id}
        if details is not None:
            content["details"] = details
        headers = {"WWW-Authenticate": "Bearer"} if status == 401 else {}
        return JSONResponse(status_code=status, content={"error": content}, headers=headers)

    @app.exception_handler(MissionError)
    async def mission_error(request: Request, exc: MissionError):
        return error_response(request, exc.code, exc.message, exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        details = [{"field": ".".join(map(str, error["loc"])), "message": error["msg"], "type": error["type"]} for error in exc.errors()]
        return error_response(request, "INVALID_REQUEST", "Revisa los campos y cabeceras de la solicitud.", 422, details)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return error_response(request, "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR", "La ruta o el método no está disponible.", exc.status_code)

    @app.exception_handler(sqlite3.OperationalError)
    async def database_error(request: Request, exc: sqlite3.OperationalError):
        logger.error("mission_database_error id=%s", getattr(request.state, "request_id", "unavailable"))
        return error_response(request, "DATABASE_UNAVAILABLE", "El almacenamiento no está disponible; vuelve a intentarlo.", 503)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", "unavailable")
        logger.error("mission_internal_error id=%s type=%s", request_id, type(exc).__name__)
        response = error_response(request, "INTERNAL_ERROR", "No se pudo completar la solicitud.", 500)
        response.headers["X-Request-ID"] = request_id
        response.headers["Cache-Control"] = "no-store"
        return response

    async def session(request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)]) -> SessionInfo:
        if credentials is None:
            raise MissionError("UNAUTHORIZED", "Crea una sesión y envía su token Bearer.", 401)
        return await asyncio.to_thread(request.app.state.store.authenticate, credentials.credentials, datetime.now(UTC))

    Session = Annotated[SessionInfo, Depends(session)]
    Key = Annotated[UUID, Header(alias="Idempotency-Key", description="UUID nuevo por intención. Reutiliza el mismo UUID y cuerpo al reintentar.")]

    def result_headers(response: Response, result: MutationResult):
        response.headers["ETag"] = f'"{result.mission.state.version}"'

    @app.get("/health/live", tags=["health"])
    async def live():
        return {"status": "ok", "service": "orbita-mission-api", "version": __version__}

    @app.get("/health/ready", tags=["health"])
    async def ready(request: Request):
        ok = await asyncio.to_thread(request.app.state.store.ready)
        return JSONResponse(status_code=200 if ok else 503, content={"status": "ready" if ok else "not_ready", "scope": "database"})

    @app.post("/api/v1/sessions", response_model=SessionCreated, status_code=201, tags=["sessions"])
    async def create_session(request: Request):
        """Crea una sesión anónima sin nombre, correo ni contraseña. El token sólo se entrega aquí."""
        return await asyncio.to_thread(request.app.state.store.create_session, datetime.now(UTC), settings.session_hours)

    @app.get("/api/v1/sessions/me", response_model=SessionInfo, tags=["sessions"])
    async def me(current: Session):
        return current

    @app.delete("/api/v1/sessions/current", status_code=204, tags=["sessions"])
    async def logout(request: Request, current: Session):
        await asyncio.to_thread(request.app.state.store.revoke, current.session_id, datetime.now(UTC))
        return Response(status_code=204)

    @app.get("/api/v1/scenarios", tags=["catalog"])
    async def scenarios() -> list[dict]:
        return [scenario_catalog(scenario_id) for scenario_id in RULESETS]

    @app.get("/api/v1/scenarios/{scenario_id}", tags=["catalog"])
    async def scenario(scenario_id: str) -> dict:
        if scenario_id not in RULESETS:
            raise MissionError("SCENARIO_NOT_FOUND", "No existe ese escenario.", 404)
        return scenario_catalog(scenario_id)

    @app.post("/api/v1/missions", response_model=MutationResult, status_code=201, tags=["missions"])
    async def create_mission(request: Request, body: CreateMission, current: Session, key: Key, response: Response):
        """Captura referencias NASA históricas y crea la partida. snapshot funciona sin internet con resources encendido."""
        # El valor histórico por defecto conserva el fingerprint de las creaciones de 0.2.
        payload = body.model_dump()
        if body.practice_mode == "historical":
            payload.pop("practice_mode")
        digest, now = fingerprint(payload), datetime.now(UTC)
        store = request.app.state.store
        result = await asyncio.to_thread(store.receipt, current.session_id, "create", str(key), digest, now)
        if result is None:
            bundle = await request.app.state.resources.capture(body.data_mode, now, body.scenario_id)
            result = await asyncio.to_thread(store.create_mission, current.session_id, body, bundle, str(key), digest, datetime.now(UTC))
        result_headers(response, result)
        return result

    @app.get("/api/v1/missions", response_model=MissionList, tags=["missions"])
    async def list_missions(request: Request, current: Session, query: Annotated[PageQuery, Query()]):
        return await asyncio.to_thread(request.app.state.store.list_missions, current.session_id, query.limit, query.offset, datetime.now(UTC))

    @app.get("/api/v1/missions/{mission_id}", response_model=MissionView, tags=["missions"])
    async def get_mission(request: Request, mission_id: UUID, current: Session, response: Response):
        state = await asyncio.to_thread(request.app.state.store.get, current.session_id, str(mission_id), datetime.now(UTC))
        response.headers["ETag"] = f'"{state.version}"'
        return view(state)

    @app.post("/api/v1/missions/{mission_id}/commands", response_model=MutationResult, tags=["missions"])
    async def command(request: Request, mission_id: UUID, body: Command, current: Session, key: Key, response: Response):
        """Aplica una decisión de forma atómica; expected_version evita cambios sobre un estado antiguo."""
        result = await asyncio.to_thread(request.app.state.store.command, current.session_id, str(mission_id), body,
                                       str(key), fingerprint(body.model_dump()), datetime.now(UTC))
        result_headers(response, result)
        return result

    @app.post("/api/v1/missions/{mission_id}/preview", response_model=PreviewResult, tags=["missions"])
    async def preview(request: Request, mission_id: UUID, body: Preview, current: Session):
        """Previsualiza una acción sobre la versión indicada sin guardar ni consumir recursos."""
        state = await asyncio.to_thread(request.app.state.store.get, current.session_id, str(mission_id), datetime.now(UTC))
        result = transition(state, Command(type="action", action_id=body.action_id, expected_version=body.expected_version), datetime.now(UTC))
        baseline = transition(state, Command(type="advance", expected_version=state.version), datetime.now(UTC))
        acted = result.mission.state
        forecast = transition(acted, Command(type="advance", expected_version=acted.version), datetime.now(UTC))
        return PreviewResult(based_on_version=state.version, result=result,
                             forecast=ForecastComparison(without_action=baseline, with_action=forecast))

    @app.post("/api/v1/missions/{mission_id}/restart", response_model=MutationResult, status_code=201, tags=["missions"])
    async def restart(request: Request, mission_id: UUID, body: RestartMission, current: Session, key: Key, response: Response):
        """Crea otra partida con la misma semilla y referencias, conservando la anterior."""
        result = await asyncio.to_thread(request.app.state.store.restart, current.session_id, str(mission_id),
                                       body.expected_version, str(key), fingerprint(body.model_dump()), datetime.now(UTC))
        result_headers(response, result)
        return result

    @app.get("/api/v1/missions/{mission_id}/events", response_model=EventList, tags=["missions"])
    async def events(request: Request, mission_id: UUID, current: Session, query: Annotated[PageQuery, Query()]):
        return await asyncio.to_thread(request.app.state.store.events, current.session_id, str(mission_id), query.limit, query.offset, datetime.now(UTC))

    @app.get("/api/v1/missions/{mission_id}/science", response_model=ScienceBundle, tags=["missions"])
    async def science(request: Request, mission_id: UUID, current: Session):
        return await asyncio.to_thread(request.app.state.store.science, current.session_id, str(mission_id), datetime.now(UTC))

    @app.get("/api/v1/missions/{mission_id}/evaluation", response_model=Evaluation, tags=["missions"])
    async def evaluation(request: Request, mission_id: UUID, current: Session):
        return await asyncio.to_thread(request.app.state.store.evaluation, current.session_id, str(mission_id), datetime.now(UTC))

    return app
