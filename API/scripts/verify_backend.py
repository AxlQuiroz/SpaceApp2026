"""Inicia dos procesos reales con datos temporales y verifica una misión completa."""
import argparse
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

from smoke_backend import run


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Descargar también las tres referencias históricas desde NASA.")
    parser.add_argument("--nextjs", action="store_true", help="Verificar el Route Handler; requiere npm ci y npm test en integrations/nextjs.")
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        resource_port, mission_port = free_port(), free_port()
        while mission_port == resource_port:
            mission_port = free_port()
        env = os.environ.copy() | {
            "RESOURCE_API_TOKEN": secrets.token_urlsafe(40), "RESOURCE_CACHE_PATH": str(temp / "resources.db"),
            "MISSION_DATABASE_PATH": str(temp / "missions.db"), "MISSION_RESOURCE_API_URL": f"http://127.0.0.1:{resource_port}",
            "MISSION_ALLOWED_HOSTS": '["localhost","127.0.0.1"]',
        }
        children = []
        try:
            with (temp / "processes.log").open("w", encoding="utf-8") as log:
                for entry, port in [("resource_api.main:create_app", resource_port), ("mission_api.main:create_app", mission_port)]:
                    children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", entry, "--factory", "--host", "127.0.0.1", "--port", str(port), "--no-access-log"], env=env, cwd=root, stdout=log, stderr=log))
                with httpx.Client(trust_env=False, timeout=1) as client:
                    for port in [resource_port, mission_port]:
                        deadline = time.monotonic() + 20
                        while time.monotonic() < deadline:
                            if any(child.poll() is not None for child in children):
                                raise RuntimeError("Un proceso terminó antes de estar disponible.")
                            try:
                                if client.get(f"http://127.0.0.1:{port}/health/ready").status_code == 200:
                                    break
                            except httpx.HTTPError:
                                pass
                            time.sleep(0.1)
                        else:
                            raise RuntimeError("El backend no quedó disponible en 20 segundos.")
                for mode in (["snapshot", "live"] if args.live else ["snapshot"]):
                    summary = run(f"http://127.0.0.1:{mission_port}", mode)
                    if args.output_dir:
                        args.output_dir.mkdir(parents=True, exist_ok=True)
                        (args.output_dir / f"smoke-{mode}.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
                if args.nextjs:
                    checked = subprocess.run(["node", str(root / "integrations/nextjs/tests/live-proxy.cjs"), f"http://127.0.0.1:{mission_port}"],
                                             cwd=root, check=True, capture_output=True, text=True)
                    summary = json.loads(checked.stdout)
                    if args.output_dir:
                        (args.output_dir / "smoke-nextjs.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(checked.stdout, end="", flush=True)
        except Exception:
            print((temp / "processes.log").read_text(encoding="utf-8"), file=sys.stderr)
            raise
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


if __name__ == "__main__":
    main()
