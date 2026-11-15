import hashlib
import json
from importlib.resources import files

from .errors import ResourceError


class SnapshotStore:
    def __init__(self):
        self.root = files("resource_api").joinpath("snapshots")
        manifest = json.loads(self.root.joinpath("manifest.json").read_text(encoding="utf-8"))
        self.entries = manifest["snapshots"]

    def catalog(self):
        return [{k: v for k, v in entry.items() if k != "file"} for entry in self.entries]

    def read(self, resource: str, query: dict):
        entry = next((e for e in self.entries if e["resource"] == resource and e["query"] == query), None)
        if entry is None:
            raise ResourceError("SNAPSHOT_NOT_FOUND", "No existe una captura para esta consulta exacta; consulta /internal/v1/snapshots.", 404)
        raw = self.root.joinpath(entry["file"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ResourceError("SNAPSHOT_INTEGRITY_FAILED", "La captura histórica no supera la verificación de integridad.", 500)
        return json.loads(raw), entry
