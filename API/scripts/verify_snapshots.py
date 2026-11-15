"""Comprueba las capturas y repara sólo conversiones CRLF verificables por SHA-256."""
import argparse
import hashlib
import json
from pathlib import Path

from resource_api.snapshot_store import SnapshotStore


def verify(root: Path, repair=False):
    entries = json.loads((root / "manifest.json").read_text(encoding="utf-8"))["snapshots"]
    repaired = []
    for entry in entries:
        path = root / entry["file"]
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() == entry["sha256"]:
            continue
        normalized = raw.replace(b"\r\n", b"\n")
        if repair and hashlib.sha256(normalized).hexdigest() == entry["sha256"]:
            path.write_bytes(normalized)
            repaired.append(entry["file"])
        else:
            raise ValueError(f"Captura inválida: {entry['file']}. Ejecuta scripts/verify_snapshots.py --repair; si persiste, restaura esa captura desde Git.")
    return len(entries), repaired


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repair", action="store_true", help="Normalizar CRLF únicamente si recupera el SHA-256 original.")
    args = parser.parse_args()
    count, repaired = verify(SnapshotStore().root, args.repair)
    print(f"{count} capturas NASA: integridad SHA-256 correcta. Reparadas: {len(repaired)}.")


if __name__ == "__main__":
    main()
