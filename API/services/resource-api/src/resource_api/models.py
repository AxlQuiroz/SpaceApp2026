from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from typing import Annotated, Any, Generic, Literal, TypeVar

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class EventType(StrEnum):
    FLR = "FLR"
    CME = "CME"
    SEP = "SEP"
    GST = "GST"


class QueryBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["live", "snapshot"] | None = None
    allow_stale: bool = True
    limit: Annotated[int, Field(ge=1, le=1000)] = 100
    offset: Annotated[int, Field(ge=0, le=100000)] = 0


class WeatherQuery(QueryBase):
    start: date
    end: date
    event_type: EventType = EventType.FLR

    @model_validator(mode="after")
    def check_range(self):
        if self.end < self.start or (self.end - self.start).days > 30:
            raise ValueError("El intervalo debe ser ordenado y abarcar como máximo 31 fechas UTC.")
        if self.end > datetime.now(UTC).date():
            raise ValueError("El catálogo de observaciones no acepta fechas futuras.")
        return self


class RadiationQuery(QueryBase):
    start: AwareDatetime
    end: AwareDatetime
    instrument: Annotated[str, Field(min_length=1, max_length=60, pattern=r"^[A-Za-z0-9][A-Za-z0-9 ._-]*$")] = "CRaTER"

    @model_validator(mode="after")
    def check_range(self):
        self.start = self.start.astimezone(UTC)
        self.end = self.end.astimezone(UTC)
        if not timedelta(0) < self.end - self.start <= timedelta(hours=24):
            raise ValueError("El intervalo debe ser mayor que cero y no superar 24 horas.")
        if self.end > datetime.now(UTC):
            raise ValueError("Las mediciones no aceptan fechas futuras.")
        return self


class SourceRecord(BaseModel):
    source_id: str
    source_url: str


class SpaceWeatherEvent(SourceRecord):
    event_type: EventType
    observed_at: AwareDatetime
    peak_at: AwareDatetime | None = None
    end_at: AwareDatetime | None = None
    classification: str | None = None
    solar_source_location: str | None = None
    instruments: list[str]
    linked_event_ids: list[str]
    details: dict[str, Any]


class Measurement(BaseModel):
    quantity: Literal["absorbed_dose_rate", "dose_equivalent_rate"]
    value: Annotated[float, Field(ge=0, allow_inf_nan=False)]
    unit: Literal["uGy/h", "uSv/h"]


class RadiationReading(SourceRecord):
    observed_at: AwareDatetime
    instrument_id: str
    celestial_body: str | None
    spacecraft: str | None
    trajectory: str | None
    measurements: list[Measurement]


class Study(SourceRecord):
    title: str
    description: str
    version: str | None
    public_release_date: str | None
    organisms: list[str]
    publications: list[dict[str, Any]]


class Pagination(BaseModel):
    total: int
    returned: int
    limit: int
    offset: int
    has_more: bool


class ResourceMeta(BaseModel):
    provider: str
    source_url: str
    attribution: str
    retrieval_mode: Literal["live", "cache", "stale_cache", "snapshot"]
    retrieved_at: AwareDatetime
    delivered_at: AwareDatetime
    query: dict[str, Any]
    warnings: list[str]
    pagination: Pagination
    snapshot_id: str | None = None
    snapshot_sha256: str | None = None


T = TypeVar("T")


class ResourceResponse(BaseModel, Generic[T]):
    schema_version: Literal["1.0"] = "1.0"
    data: list[T]
    meta: ResourceMeta


class ErrorDetail(BaseModel):
    field: str
    message: str
    type: str


class ErrorInfo(BaseModel):
    code: str
    message: str
    request_id: str
    provider: str | None = None
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorInfo
