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
    practice_mode: Literal["historical", "training"] = "historical"


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
    earth_message_data_points: Annotated[int, Field(ge=0)] = 0
    earth_reply_due_minutes: NonNegative | None = None


class EarthGuidance(Model):
    received_turn: Annotated[int, Field(ge=0, le=12)]
    valid_until_turn: Annotated[int, Field(ge=0, le=12)]
    advice_code: Literal["shelter_now", "save_power", "clean_panels", "research_window"]
    next_turn_dose_rate_ugy_h: NonNegative | None
    suggested_eva_turn: Annotated[int, Field(ge=0, le=11)] | None
    dust_start_turn: Annotated[int, Field(ge=0, le=12)] | None
    dust_end_turn: Annotated[int, Field(ge=0, le=12)] | None


class MissionState(Model):
    id: str
    scenario_id: ScenarioId = "lunar-outpost-v1"
    rules_version: Literal["lunar-1.0.0", "mars-1.0.0", "lunar-1.1.0", "mars-1.1.0", "lunar-1.2.0", "mars-1.2.0"] = "lunar-1.0.0"
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
    unreported_data_points: Annotated[int, Field(ge=0)] = 0
    reported_data_points: Annotated[int, Field(ge=0)] = 0
    practice_mode: Literal["historical", "training"] = "historical"
    radiation_profile_ugy_h: list[NonNegative] = Field(default_factory=list, max_length=12)
    radiation_profile_source_hash: str | None = None
    earth_guidance: EarthGuidance | None = None
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
    model_derivations: dict[str, Any] = Field(default_factory=dict)
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


class PlanningIndicators(Model):
    food_autonomy_hours: NonNegative
    food_reserve_target_kg: NonNegative
    pending_reply_minutes: NonNegative | None
    radio_round_trip_minutes: int
    shelter_recommended: bool = False
    exposure_target_points: NonNegative | None = None


class MissionView(Model):
    state: MissionState
    available_actions: list[ActionOption]
    alerts: list[str]
    planning: PlanningIndicators | None = None


class MutationResult(Model):
    mission: MissionView
    events: list[TimelineEvent]


class ForecastComparison(Model):
    horizon_hours: int = 2
    without_action: MutationResult
    with_action: MutationResult


class PreviewResult(Model):
    persisted: Literal[False] = False
    based_on_version: int
    result: MutationResult
    forecast: ForecastComparison | None = None


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


class DecisionDifference(Model):
    turn: int
    previous: list[ActionId]
    current: list[ActionId]


class MissionComparison(Model):
    previous_mission_id: str
    previous_turns: int
    current_turns: int
    score_delta: int
    health_delta: float
    exposure_delta: float
    food_delta_kg: float
    energy_delta_kwh: float
    decisions: list[DecisionDifference]


class Evaluation(Model):
    mission_id: str
    final: bool
    outcome: Literal["in_progress", "success", "partial", "failed", "aborted"]
    score: Annotated[int, Field(ge=0, le=100)]
    objectives: dict[str, bool]
    feedback: list[str]
    feedback_codes: list[str] = Field(default_factory=list)
    comparison: MissionComparison | None = None
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
