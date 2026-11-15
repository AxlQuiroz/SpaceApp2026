"""Ejecuta ambos servicios localmente con el Python del entorno actual."""
import os
import subprocess
import sys
import time
from pathlib import Path

from dotenv import load_dotenv


def main():
    root = Path(__file__).resolve().parents[1]
    if not (root / ".env").exists() and not os.environ.get("RESOURCE_API_TOKEN"):
        raise SystemExit("Primero ejecuta: python scripts/setup_backend.py")
    load_dotenv(root / ".env")
    # Validar antes de iniciar procesos; nunca imprimir el contenido de Settings ni de .env.
    try:
        from mission_api.config import Settings
        from resource_api.config import Settings as ResourceSettings
        from resource_api.snapshot_store import SnapshotStore
        from verify_snapshots import verify
        Settings(_env_file=root / ".env")
        ResourceSettings(_env_file=root / ".env")
    except Exception as exc:
        raise SystemExit(f"Configuración inválida ({type(exc).__name__}). Revisa .env.example sin compartir tus tokens.") from None
    try:
        _, repaired = verify(SnapshotStore().root, repair=True)
        if repaired:
            print("Capturas históricas: saltos de línea normalizados y SHA-256 verificado.", flush=True)
    except ValueError as exc:
        raise SystemExit(str(exc)) from None
    children = []
    exit_code = 0
    try:
        for entrypoint, port in [("resource_api.main:create_app", "8001"), ("mission_api.main:create_app", "8000")]:
            children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", entrypoint, "--factory", "--host", "127.0.0.1", "--port", port, "--no-access-log"], cwd=root))
        print("Backend: http://127.0.0.1:8000/docs · Recursos internos: http://127.0.0.1:8001/docs", flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(0.25)
        exit_code = next((child.returncode for child in children if child.returncode), 1)
    except KeyboardInterrupt:
        print("Cerrando backend...", flush=True)
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
