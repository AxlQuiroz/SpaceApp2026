from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

Difficulty = Literal["cadet", "commander"]
Status = Literal["active", "paused", "completed", "failed", "aborted"]
ActionId = Literal[
    "repair_water_loop", "repair_solar_panels", "enter_shelter", "leave_shelter", "explore",
    "activate_oxygen_reserve", "activate_water_reserve", "toggle_greenhouse", "toggle_oxygen_generator",
    "contact_earth",
]
ScenarioId = Literal["lunar-outpost-v1", "mars-outpost-v1"]
NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Percent = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)


class CreateMission(Model):
    scenario_id: ScenarioId = "lunar-outpost-v1"
    difficulty: Difficulty = "cadet"
    seed: Annotated[int, Field(strict=True, ge=0, le=2147483647)] = 42
    data_mode: Literal["snapshot", "live"] = "snapshot"


class Command(Model):
    type: Literal["action", "advance", "pause", "resume", "abort"]
    expected_version: Annotated[int, Field(strict=True, ge=1)]
    action_id: ActionId | None = None

    @model_validator(mode="after")
    def validate_action(self):
        if (self.type == "action") != (self.action_id is not None):
            raise ValueError("action_id es obligatorio exclusivamente para type=action.")
        return self


class RestartMission(Model):
    expected_version: Annotated[int, Field(strict=True, ge=1)]


class Preview(Model):
    action_id: ActionId
    expected_version: Annotated[int, Field(strict=True, ge=1)]


class Resources(Model):
    energy_kwh: NonNegative
    oxygen_kg: NonNegative
    water_l: NonNegative
    food_kg: NonNegative
    spare_parts: Annotated[int, Field(ge=0)]
    reserve_oxygen_kg: NonNegative = 1.2
    reserve_water_l: NonNegative = 6


class Systems(Model):
    solar_integrity_pct: Percent = 100
    oxygen_generator_on: bool = True
    greenhouse_on: bool = True
    water_leak_active: bool = False
    crew_in_shelter: bool = False
    # Sólo cambian en el escenario marciano.
    dust_storm_active: bool = False
    earth_message_pending: bool = False


class MissionState(Model):
    id: str
    scenario_id: ScenarioId = "lunar-outpost-v1"
    rules_version: Literal["lunar-1.0.0", "mars-1.0.0"] = "lunar-1.0.0"
    version: int = 1
    status: Status = "active"
    difficulty: Difficulty
    seed: int
    turn: Annotated[int, Field(ge=0, le=12)] = 0
    elapsed_hours: NonNegative = 0
    duration_hours: int = 24
    turn_hours: int = 2
    actions_used: Annotated[int, Field(ge=0, le=2)] = 0
    crew_count: int = 4
    crew_health_pct: Percent = 100
    exposure_risk_index: Percent = 0
    science_points: Annotated[int, Field(ge=0)] = 0
    resources: Resources
    systems: Systems = Field(default_factory=Systems)
    created_at: AwareDatetime
    updated_at: AwareDatetime
    parent_mission_id: str | None = None
    end_reason: str | None = None
    science_bundle_id: str


class TimelineEvent(Model):
    type: str
    turn: int
    message: str
    occurred_at: AwareDatetime
    payload: dict[str, Any] = Field(default_factory=dict)
    source_refs: list[str] = Field(default_factory=list)
    rule_origin: Literal["simulation"] = "simulation"


class SourceItem(Model):
    id: str
    role: str
    interpretation: str
    records: list[dict[str, Any]]
    pages_meta: list[dict[str, Any]]


class ScienceBundle(Model):
    id: str
    requested_mode: Literal["snapshot", "live"]
    captured_at: AwareDatetime
    historical_replay: Literal[True] = True
    sources: list[SourceItem]
    notice: str = (
        "Los registros NASA son referencias históricas de contextos distintos. "
        "Los consumos, incidentes, puntuación y el índice de riesgo son reglas didácticas del simulador. "
        "El índice de riesgo no representa una dosis ni una evaluación de seguridad humana."
    )


class ActionOption(Model):
    id: ActionId
    title: str
    description: str
    enabled: bool
    disabled_reason: str | None
    costs: dict[str, float]


class MissionView(Model):
    state: MissionState
    available_actions: list[ActionOption]
    alerts: list[str]


class MutationResult(Model):
    mission: MissionView
    events: list[TimelineEvent]


class PreviewResult(Model):
    persisted: Literal[False] = False
    based_on_version: int
    result: MutationResult


class SessionInfo(Model):
    session_id: str
    created_at: AwareDatetime
    expires_at: AwareDatetime


class SessionCreated(SessionInfo):
    access_token: str
    token_type: Literal["Bearer"] = "Bearer"


class MissionSummary(Model):
    id: str
    scenario_id: str
    status: Status
    version: int
    turn: int
    updated_at: AwareDatetime


class MissionList(Model):
    data: list[MissionSummary]
    total: int
    limit: int
    offset: int


class StoredEvent(Model):
    sequence: int
    mission_version: int
    event: TimelineEvent


class EventList(Model):
    data: list[StoredEvent]
    total: int
    limit: int
    offset: int


class Evaluation(Model):
    mission_id: str
    final: bool
    outcome: Literal["in_progress", "success", "partial", "failed", "aborted"]
    score: Annotated[int, Field(ge=0, le=100)]
    objectives: dict[str, bool]
    feedback: list[str]
    rules_version: str


class ErrorDetail(Model):
    field: str
    message: str
    type: str


class ErrorInfo(Model):
    # Los handlers pueden omitir details; no convertirlo en obligatorio en el contrato.
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=False)
    code: str
    message: str
    request_id: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(Model):
    error: ErrorInfo
