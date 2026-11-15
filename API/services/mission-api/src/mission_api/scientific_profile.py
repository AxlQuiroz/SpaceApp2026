"""Derivación trazable; las observaciones originales se conservan en el bundle."""
import hashlib
import json
import math
from datetime import UTC, datetime

from .errors import MissionError


def derive_mars_radiation(records: list[dict], metadata: list[dict]) -> dict:
    bins: list[list[float]] = [[] for _ in range(12)]
    seen = set()
    try:
        for record in records:
            stamp = datetime.fromisoformat(record["observed_at"].replace("Z", "+00:00")).astimezone(UTC)
            if (stamp.date().isoformat() != "2024-05-20" or record.get("celestial_body") != "Mars"
                    or record.get("spacecraft") != "Curiosity" or record["source_id"] in seen):
                raise ValueError("Contexto radiométrico inconsistente")
            seen.add(record["source_id"])
            for measurement in record["measurements"]:
                if measurement["quantity"] == "absorbed_dose_rate":
                    value = measurement["value"]
                    if measurement["unit"] != "uGy/h" or isinstance(value, bool) or not math.isfinite(value) or value < 0:
                        raise ValueError("Magnitud no admitida")
                    bins[stamp.hour // 2].append(value)
        if any(not values for values in bins):
            raise ValueError("Faltan intervalos observados; no se inventan ceros")
    except (ValueError, TypeError, KeyError):
        raise MissionError("RESOURCE_CONTRACT_ERROR", "La radiación no permite reconstruir los doce intervalos históricos de Marte.", 502) from None
    canonical = json.dumps(sorted(records, key=lambda r: r["source_id"]), sort_keys=True, separators=(",", ":"))
    return {
        "source_id": "radlab-reference", "instrument": "MSL-RAD", "spacecraft": "Curiosity",
        "environment": "Mars surface", "observation_start_utc": "2024-05-20T00:00:00Z",
        "observation_end_utc": "2024-05-21T00:00:00Z", "unit": "uGy/h",
        "transformation": "utc-2h-arithmetic-mean-round2-v1", "counts": [len(b) for b in bins],
        "values": [round(sum(b) / len(b), 2) for b in bins],
        "normalized_records_sha256": hashlib.sha256(canonical.encode()).hexdigest(),
        "snapshot_sha256": sorted({m["snapshot_sha256"] for m in metadata if m.get("snapshot_sha256")}),
    }
