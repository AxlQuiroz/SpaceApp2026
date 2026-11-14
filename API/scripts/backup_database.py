"""Copia coherente de SQLite, incluyendo transacciones confirmadas en WAL."""
import argparse
import sqlite3
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    source, destination = args.source.resolve(), args.destination.resolve()
    if not source.is_file() or destination.exists() or source == destination:
        raise SystemExit("La fuente debe existir y el destino debe ser un archivo nuevo.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as current:
        with sqlite3.connect(destination) as backup:
            current.backup(backup)
            if backup.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise SystemExit("La verificación de la copia no pasó.")
    destination.chmod(0o600)
    print(f"Copia verificada: {destination.name}")


if __name__ == "__main__":
    main()
