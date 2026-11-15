from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from pydantic import ValidationError

from .config import Settings
from .errors import ResourceError
from .models import (EventType, Measurement, RadiationQuery, RadiationReading,
                     SpaceWeatherEvent, Study, WeatherQuery)
from .transport import public_url


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def parse_time(value: Any) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError("Falta la fecha del registro.")
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return stamp.replace(tzinfo=UTC) if stamp.tzinfo is None else stamp.astimezone(UTC)


def optional_text(value: Any) -> str | None:
    return None if value is None or value in ("", "NA", "NaN") else str(value)


def source_link(value: Any, fallback: str) -> str:
    if isinstance(value, str):
        parts = urlsplit(value)
        if parts.scheme == "https" and (parts.hostname or "").endswith(".nasa.gov"):
            return value
    return fallback


@dataclass(frozen=True)
class ResourceSpec:
    resource: str
    provider: str
    query: dict[str, Any]
    url: str
    params: dict[str, Any]
    attribution: str

    @property
    def source_url(self) -> str:
        return public_url(self.url, self.params)


def weather_spec(query: WeatherQuery, settings: Settings) -> ResourceSpec:
    kind = query.event_type.value
    params = {"startDate": query.start.isoformat(), "endDate": query.end.isoformat()}
    if settings.donki_gateway == "ccmc":
        url = f"https://ccmc.gsfc.nasa.gov/DONKI/WS/get/{kind}"
    else:
        url = f"https://api.nasa.gov/DONKI/{kind}"
        params["api_key"] = settings.nasa_api_key.get_secret_value()
    return ResourceSpec(f"donki:{kind}", "donki", {"start": query.start.isoformat(), "end": query.end.isoformat()},
                        url, params, "NASA CCMC / Moon to Mars Space Weather Analysis Office — DONKI")


# El analizador de expresiones de RadLab rechaza valores con guion (instrument='MSL-RAD' devuelve 500).
# MSL-RAD es el único instrumento del rover Curiosity, así que se selecciona por nave.
RADLAB_SELECTORS = {"MSL-RAD": "spacecraft='Curiosity'"}


def radiation_spec(query: RadiationQuery) -> ResourceSpec:
    # Sintaxis booleana para expresar exactamente el intervalo [start, end).
    # RadLab rechaza el sufijo Z en la expresión: enviar UTC sin sufijo sólo al proveedor.
    # El contrato propio y la identidad de consulta conservan UTC explícito.
    start = query.start.astimezone(UTC).replace(tzinfo=None).isoformat()
    end = query.end.astimezone(UTC).replace(tzinfo=None).isoformat()
    selector = RADLAB_SELECTORS.get(query.instrument, f"instrument='{query.instrument}'")
    expression = f"(timestamp>={start})AND(timestamp<{end})AND({selector})"
    params = {"query": expression,
              "fields": "absorbed_dose_rate,dose_equivalent_rate,celestial_body,spacecraft,trajectory", "format": "json"}
    return ResourceSpec("radlab", "radlab", {"start": iso(query.start), "end": iso(query.end), "instrument": query.instrument},
                        "https://visualization.osdr.nasa.gov/radlab/api/", params,
                        "NASA Open Science Data Repository — RadLab; conservar atribución del instrumento")


def study_spec(study_id: int) -> ResourceSpec:
    return ResourceSpec("osdr", "osdr", {"study_id": study_id},
                        f"https://osdr.nasa.gov/osdr/data/osd/meta/{study_id}", {},
                        "NASA Open Science Data Repository (OSDR); citar también a los autores del estudio")


def normalize(spec: ResourceSpec, payload: Any):
    try:
        if spec.provider == "donki":
            return normalize_weather(spec, payload)
        if spec.provider == "radlab":
            return normalize_radiation(spec, payload)
        return normalize_study(spec, payload)
    except (ValueError, TypeError, KeyError, IndexError, AttributeError, ValidationError):
        raise ResourceError("UPSTREAM_SCHEMA_CHANGED", "La estructura o los valores del proveedor no cumplen el contrato.",
                            provider=spec.provider) from None


def normalize_weather(spec: ResourceSpec, payload: Any):
    warnings = ["DONKI aporta eventos observados y análisis; no mide la dosis de una base lunar o marciana."]
    if payload is None:
        return [], warnings
    if not isinstance(payload, list):
        raise ValueError("Se esperaba una lista DONKI.")
    kind = EventType(spec.resource.split(":")[1])
    id_key, time_key = {EventType.FLR: ("flrID", "beginTime"), EventType.CME: ("activityID", "startTime"),
                        EventType.SEP: ("sepID", "eventTime"), EventType.GST: ("gstID", "startTime")}[kind]
    records = []
    ids = set()
    for row in payload:
        record_id = row[id_key]
        if not isinstance(record_id, str) or not record_id or record_id in ids:
            raise ValueError("Identificador vacío o duplicado.")
        ids.add(record_id)
        record = SpaceWeatherEvent(source_id=record_id, source_url=source_link(row.get("link"), spec.source_url),
            event_type=kind, observed_at=parse_time(row[time_key]),
            peak_at=parse_time(row["peakTime"]) if row.get("peakTime") else None,
            end_at=parse_time(row["endTime"]) if row.get("endTime") else None,
            classification=row.get("classType"), solar_source_location=row.get("sourceLocation"),
            instruments=[str(item["displayName"]) for item in row.get("instruments") or []],
            linked_event_ids=[str(item["activityID"]) for item in row.get("linkedEvents") or []], details=row)
        if not spec.query["start"] <= record.observed_at.date().isoformat() <= spec.query["end"]:
            raise ValueError("DONKI devolvió un evento fuera de las fechas solicitadas.")
        records.append(record.model_dump(mode="json"))
    records.sort(key=lambda r: (r["observed_at"], r["source_id"]))
    return records, warnings


def normalize_radiation(spec: ResourceSpec, payload: Any):
    if not isinstance(payload, dict) or not isinstance(payload.get("columns"), list) or not isinstance(payload.get("data"), list):
        raise ValueError("RadLab requiere JSON split: columns/data.")
    columns = payload["columns"]
    if len(set(columns)) != len(columns) or not {"timestamp", "instrument_id", "absorbed_dose_rate", "dose_equivalent_rate"}.issubset(columns):
        raise ValueError("Faltan columnas de RadLab.")
    records, ids = [], set()
    warnings = ["Las mediciones pertenecen al instrumento y trayectoria indicados; no representan automáticamente la superficie ni la dosis humana.",
                "uGy/h y uSv/h son magnitudes distintas; esta API no las convierte entre sí."]
    naive_time = False
    start, end = parse_time(spec.query["start"]), parse_time(spec.query["end"])
    for values in payload["data"]:
        if not isinstance(values, list) or len(values) != len(columns):
            raise ValueError("Fila RadLab incompleta.")
        row = dict(zip(columns, values, strict=True))
        stamp = parse_time(row["timestamp"])
        if not start <= stamp < end:
            raise ValueError("Medición RadLab fuera del intervalo [start, end).")
        naive_time |= datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00")).tzinfo is None
        instrument_id = optional_text(row["instrument_id"])
        if not instrument_id:
            raise ValueError("Falta instrumento.")
        record_id = f"{instrument_id}:{iso(stamp)}"
        if record_id in ids:
            raise ValueError("Medición duplicada.")
        ids.add(record_id)
        measurements = []
        for field, unit in (("absorbed_dose_rate", "uGy/h"), ("dose_equivalent_rate", "uSv/h")):
            raw = row[field]
            if optional_text(raw) is not None:
                if isinstance(raw, bool):
                    raise ValueError("Una medición no puede ser booleana.")
                measurements.append(Measurement(quantity=field, value=float(raw), unit=unit))
        record = RadiationReading(source_id=record_id, source_url=spec.source_url, observed_at=stamp,
            instrument_id=instrument_id, celestial_body=optional_text(row.get("celestial_body")),
            spacecraft=optional_text(row.get("spacecraft")), trajectory=optional_text(row.get("trajectory")),
            measurements=measurements)
        records.append(record.model_dump(mode="json"))
    if naive_time:
        warnings.append("Los timestamps sin zona de RadLab se interpretaron como UTC.")
    if any(not r["measurements"] for r in records):
        warnings.append("Existen filas sin mediciones disponibles; no se sustituyeron por cero.")
    records.sort(key=lambda r: (r["observed_at"], r["source_id"]))
    return records, warnings


def normalize_study(spec: ResourceSpec, payload: Any):
    if not isinstance(payload, dict):
        raise ValueError("OSDR requiere un objeto.")
    if payload.get("hits") == 0:
        raise ResourceError("RESOURCE_NOT_FOUND", "El estudio OSDR no existe o no es público.", 404, "osdr")
    accession = f"OSD-{spec.query['study_id']}"
    study = payload["study"][accession]
    item = study["studies"][0]
    if str(item["identifier"]) not in {str(spec.query["study_id"]), accession, f"GLDS-{spec.query['study_id']}"}:
        raise ValueError("El identificador del estudio no coincide.")
    title = item["title"]
    if not isinstance(title, str) or not title.strip():
        raise ValueError("El estudio no tiene título.")
    organisms = set()
    categories = {category.get("@id"): category.get("characteristicType", {}).get("annotationValue", "")
                  for category in item.get("characteristicCategories", [])}
    for sample in item.get("materials", {}).get("samples", []):
        for characteristic in sample.get("characteristics", []):
            reference = characteristic.get("category", {})
            category = reference.get("characteristicType", {}).get("annotationValue") or categories.get(reference.get("@id"), "")
            if str(category).lower() == "organism":
                value = characteristic.get("value")
                name = value.get("annotationValue") if isinstance(value, dict) else value
                if name:
                    organisms.add(str(name))
    record = Study(source_id=accession, source_url=f"https://osdr.nasa.gov/bio/repo/data/studies/{accession}",
        title=title, description=item.get("description") or "", version=optional_text(study.get("version")),
        public_release_date=optional_text(item.get("publicReleaseDate")), organisms=sorted(organisms),
        publications=item.get("publications") or [])
    return [record.model_dump(mode="json")], ["Los metadatos de un estudio no son coeficientes del simulador ni resultados clínicos generalizables."]
