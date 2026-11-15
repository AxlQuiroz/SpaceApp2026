"""Backend efímero para las pruebas del frontend. No modifica .env ni partidas reales."""
import os
import secrets
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parents[1]
children = []

def stop(*_args):
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
    raise SystemExit(0)

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
with tempfile.TemporaryDirectory(prefix="selene-e2e-") as directory:
    env = os.environ.copy() | {
        "RESOURCE_API_TOKEN": secrets.token_urlsafe(40),
        "RESOURCE_CACHE_PATH": str(Path(directory) / "resources.db"),
        "MISSION_DATABASE_PATH": str(Path(directory) / "missions.db"),
        "MISSION_RESOURCE_API_URL": "http://127.0.0.1:8701",
        "MISSION_ALLOWED_HOSTS": '["localhost","127.0.0.1"]',
        "MISSION_REQUESTS_PER_MINUTE": "10000",
        "MISSION_SESSIONS_PER_HOUR": "1000",
    }
    try:
        for module, port in [("resource_api.main:create_app", 8701), ("mission_api.main:create_app", 8700)]:
            child = subprocess.Popen([sys.executable, "-m", "uvicorn", module, "--factory", "--host", "127.0.0.1", "--port", str(port), "--no-access-log"], cwd=root / "API", env=env)
            children.append(child)
            with httpx.Client(trust_env=False, timeout=1) as client:
                for _ in range(200):
                    if child.poll() is not None:
                        raise RuntimeError("El backend de prueba terminó antes de iniciar.")
                    try:
                        if client.get(f"http://127.0.0.1:{port}/health/ready").status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    time.sleep(0.1)
                else:
                    raise RuntimeError("El backend de prueba no quedó disponible.")
        while all(child.poll() is None for child in children):
            time.sleep(0.2)
        raise RuntimeError("Un servicio de prueba terminó inesperadamente.")
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
