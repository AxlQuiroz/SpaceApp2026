"""Lanzador local de RockieOS. Python 3.12; el menú sólo usa la biblioteca estándar."""
import argparse
import contextlib
import hashlib
import html
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WINDOWS = os.name == "nt"
APP_URL = "http://localhost:3000"


class LauncherError(Exception):
    pass


class WindowsJob:
    """Cerrar el job libera también los nietos, aunque ya haya terminado su padre."""
    def __init__(self):
        import ctypes
        from ctypes import wintypes as w

        class Basic(ctypes.Structure):
            _fields_ = [("ProcessTime", ctypes.c_int64), ("JobTime", ctypes.c_int64),
                        ("Flags", w.DWORD), ("MinSet", ctypes.c_size_t), ("MaxSet", ctypes.c_size_t),
                        ("ActiveLimit", w.DWORD), ("Affinity", ctypes.c_size_t),
                        ("Priority", w.DWORD), ("Scheduling", w.DWORD)]

        class Counters(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in
                        ("ReadOps", "WriteOps", "OtherOps", "ReadBytes", "WriteBytes", "OtherBytes")]

        class Extended(ctypes.Structure):
            _fields_ = [("Basic", Basic), ("IO", Counters), ("ProcessMemory", ctypes.c_size_t),
                        ("JobMemory", ctypes.c_size_t), ("PeakProcess", ctypes.c_size_t), ("PeakJob", ctypes.c_size_t)]

        self.api = ctypes.WinDLL("kernel32", use_last_error=True)
        for name, args, result in [
            ("CreateJobObjectW", [ctypes.c_void_p, w.LPCWSTR], w.HANDLE),
            ("SetInformationJobObject", [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD], w.BOOL),
            ("AssignProcessToJobObject", [w.HANDLE, w.HANDLE], w.BOOL),
            ("OpenProcess", [w.DWORD, w.BOOL, w.DWORD], w.HANDLE),
            ("CloseHandle", [w.HANDLE], w.BOOL),
        ]:
            method = getattr(self.api, name)
            method.argtypes, method.restype = args, result
        self.handle = self.api.CreateJobObjectW(None, None)
        if not self.handle:
            raise ctypes.WinError(ctypes.get_last_error())
        info = Extended()
        info.Basic.Flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not self.api.SetInformationJobObject(self.handle, 9, ctypes.byref(info), ctypes.sizeof(info)):
            error = ctypes.WinError(ctypes.get_last_error())
            self.close()
            raise error

    def assign(self, pid):
        import ctypes
        process = self.api.OpenProcess(0x0101, False, pid)  # SET_QUOTA | TERMINATE
        if not process:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            if not self.api.AssignProcessToJobObject(self.handle, process):
                raise ctypes.WinError(ctypes.get_last_error())
        finally:
            self.api.CloseHandle(process)

    def close(self):
        if self.handle:
            self.api.CloseHandle(self.handle)
            self.handle = None


class Process:
    """Cada proceso pertenece a un grupo propio; nunca se cierra por nombre o puerto."""
    def __init__(self, command, *, cwd, env, stdout):
        self.job = WindowsJob() if WINDOWS else None
        self.child = None
        options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WINDOWS else {"start_new_session": True}
        try:
            self.child = subprocess.Popen([str(arg) for arg in command], cwd=cwd, env=env,
                                          stdout=stdout, stderr=subprocess.STDOUT,
                                          text=True, encoding="utf-8", errors="replace", **options)
            if self.job:
                self.job.assign(self.child.pid)
        except Exception:
            if self.child is not None:
                if WINDOWS:
                    subprocess.run(["taskkill", "/PID", str(self.child.pid), "/T", "/F"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    os.killpg(self.child.pid, signal.SIGKILL)
                self.child.wait()
            if self.job:
                self.job.close()
            raise

    def stop(self):
        if WINDOWS:
            if self.child.poll() is None:
                try:
                    self.child.send_signal(signal.CTRL_BREAK_EVENT)
                    self.child.wait(timeout=8)
                except (OSError, subprocess.TimeoutExpired):
                    pass
            self.job.close()
        else:
            try:
                os.killpg(self.child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                self.child.wait(timeout=8)
            except subprocess.TimeoutExpired:
                pass
            try:
                os.killpg(self.child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        self.child.wait(timeout=8)


@contextlib.contextmanager
def project_lock(root):
    folder = root / ".rockieos"
    folder.mkdir(exist_ok=True)
    with (folder / "launcher.lock").open("a+b") as file:
        if file.tell() == 0:
            file.write(b"0")
            file.flush()
        file.seek(0)
        try:
            if WINDOWS:
                import msvcrt
                msvcrt.locking(file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise LauncherError("Ya hay una operación del lanzador en esta carpeta. Ciérrala primero.") from None
        try:
            yield
        finally:
            if WINDOWS:
                file.seek(0)
                msvcrt.locking(file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(file, fcntl.LOCK_UN)


def occupied_ports(ports):
    occupied = []
    for port in ports:
        for family, host in [(socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")]:
            try:
                with socket.socket(family) as sock:
                    if not WINDOWS:
                        # TIME_WAIT tras cerrar Uvicorn no equivale a un servidor activo.
                        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    sock.bind((host, port))
            except OSError as exc:
                # IPv6 puede estar deshabilitado; no implica un puerto ocupado.
                if family == socket.AF_INET or exc.errno in {48, 98, 10048}:
                    occupied.append(port)
                    break
    return occupied


def require_free_ports(ports):
    occupied = occupied_ports(ports)
    if occupied:
        raise LauncherError("Puertos ocupados: " + ", ".join(map(str, occupied)) +
                            ". Cierra las terminales que los utilizan y vuelve a intentarlo.")


def build_fingerprint(root):
    files = [path for folder in ("src", "public") for path in (root / folder).rglob("*") if path.is_file()]
    for pattern in ("package*.json", "next.config.*", "tsconfig.json", "postcss.config.*", ".env*"):
        files.extend(path for path in root.glob(pattern) if path.is_file())
    digest = hashlib.sha256()
    for path in sorted(set(files)):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
    # Las fuentes/configuración pueden tener ramas de compilación según el entorno.
    for key, value in sorted(os.environ.items()):
        if key.startswith("NEXT_PUBLIC_"):
            digest.update(f"{key}={value}".encode())
    return digest.hexdigest()


class Launcher:
    def __init__(self, root=ROOT):
        self.root = root
        self.api = root / "API"
        self.python = self.api / (".venv/Scripts/python.exe" if WINDOWS else ".venv/bin/python")
        self.npm = shutil.which("npm.cmd" if WINDOWS else "npm")
        self.node = shutil.which("node")
        self.directory = None
        self.steps = []
        self.env = os.environ.copy() | {"PYTHONUTF8": "1", "PYTHONUNBUFFERED": "1", "NEXT_TELEMETRY_DISABLED": "1"}

    def runtimes(self, backend=True):
        if sys.version_info[:2] != (3, 12):
            raise LauncherError("Usa Python 3.12 para este lanzador (en Windows abre RockieOS.cmd).")
        if not self.node or not self.npm:
            raise LauncherError("Instala Node.js 24 y vuelve a abrir la terminal.")
        version = subprocess.check_output([self.node, "--version"], text=True).strip()
        if int(version.lstrip("v").split(".")[0]) < 24:
            raise LauncherError(f"Se requiere Node.js 24 o posterior; se detectó {version}.")
        print(f"Python {sys.version.split()[0]} · Node {version}", flush=True)
        if backend:
            if not self.python.exists():
                raise LauncherError("Falta API/.venv. Ejecuta primero la opción Preparar dependencias.")
            checked = subprocess.run([str(self.python), "-c",
                                      "import sys; assert sys.version_info[:2] == (3,12); import mission_api, resource_api, dotenv, uvicorn"],
                                     cwd=self.api, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if checked.returncode:
                raise LauncherError("El entorno API/.venv necesita Python 3.12 y sus dependencias. Ejecuta Preparar dependencias.")
            if not (self.root / "node_modules/next/dist/bin/next").exists():
                raise LauncherError("Faltan las dependencias del frontend. Ejecuta Preparar dependencias.")

    def step(self, name, command, *, cwd=None, env=None):
        print(f"\n>>> {name}", flush=True)
        log_path = self.directory / f"{len(self.steps) + 1:02d}.log"
        result = {"name": name, "log": log_path.name, "exit_code": None}
        self.steps.append(result)
        started = time.monotonic()
        process = None
        thread = None
        try:
            with log_path.open("w", encoding="utf-8") as log:
                process = Process(command, cwd=cwd or self.root, env=env or self.env, stdout=subprocess.PIPE)

                def copy_output():
                    for line in process.child.stdout:
                        log.write(line)
                        log.flush()
                        print(line, end="", flush=True)

                thread = threading.Thread(target=copy_output, daemon=True)
                thread.start()
                try:
                    result["exit_code"] = process.child.wait()
                finally:
                    process.stop()
                    thread.join(timeout=3)
                    process.child.stdout.close()
        finally:
            result["seconds"] = round(time.monotonic() - started, 2)
        if result["exit_code"] != 0:
            raise LauncherError(f"Falló: {name}. Revisa {log_path.relative_to(self.root)}.")

    def configs(self):
        self.step("Configuración del backend", [self.python, self.api / "scripts/setup_backend.py"])
        target = self.root / ".env.local"
        if not target.exists():
            try:
                with target.open("xb") as file:
                    file.write((self.root / ".env.local.example").read_bytes())
                print("Creado .env.local.")
            except FileExistsError:
                pass

    def snapshots(self):
        self.step("Integridad de capturas NASA", [self.python, self.api / "scripts/verify_snapshots.py", "--repair"])

    def prepare(self):
        require_free_ports([3000, 8000, 8001, 3100, 8700, 8701])
        self.runtimes(backend=False)
        if not self.python.exists():
            self.step("Crear entorno Python 3.12", [sys.executable, "-m", "venv", self.api / ".venv"])
        else:
            version = subprocess.run([str(self.python), "-c", "import sys; sys.exit(sys.version_info[:2] != (3,12))"])
            if version.returncode:
                raise LauncherError("API/.venv fue creado con otro Python. Renómbralo y vuelve a preparar con Python 3.12.")
        self.step("Instalar backend", [self.python, "-m", "pip", "install", "-r", self.api / "backend-requirements.lock"])
        self.step("Registrar servicios Python", [self.python, "-m", "pip", "install", "-e", self.api / "services/resource-api",
                                                "-e", self.api / "services/mission-api", "--no-deps"])
        self.step("Instalar frontend", [self.npm, "ci", "--ignore-scripts"])
        self.step("Instalar adaptador Next.js", [self.npm, "ci", "--ignore-scripts"], cwd=self.api / "integrations/nextjs")
        self.configs()
        self.snapshots()
        print("\nPreparación terminada. Ya puedes iniciar la presentación o ejecutar las pruebas.")

    def build(self):
        marker = self.root / ".rockieos/build.json"
        build_id = self.root / ".next/BUILD_ID"
        # El marcador anterior nunca valida una compilación fallida.
        marker.unlink(missing_ok=True)
        self.step("Compilar frontend para presentación", [self.npm, "run", "build"])
        marker.write_text(json.dumps({"fingerprint": build_fingerprint(self.root), "build_id": build_id.read_text().strip()}), encoding="utf-8")

    def build_is_current(self):
        try:
            marker = json.loads((self.root / ".rockieos/build.json").read_text())
            return (marker["fingerprint"] == build_fingerprint(self.root) and
                    marker["build_id"] == (self.root / ".next/BUILD_ID").read_text().strip())
        except (OSError, ValueError, KeyError):
            return False

    def test(self, quick=False):
        require_free_ports([3000, 8000, 8001] + ([] if quick else [3100, 8700, 8701]))
        self.runtimes()
        if not (self.api / "integrations/nextjs/node_modules/typescript").exists():
            raise LauncherError("Faltan dependencias del adaptador. Ejecuta Preparar dependencias.")
        self.snapshots()
        self.step("OpenAPI y tipos generados", [self.python, self.api / "scripts/export_contracts.py", "--check"])
        self.step("Pruebas del lanzador", [sys.executable, "-m", "unittest", "discover", "-s", "scripts/tests", "-v"])
        for script, name in [("check:contracts", "Contratos frontend/backend"), ("lint", "Análisis del frontend"),
                             ("typecheck", "Tipos del frontend"), ("test", "Pruebas del frontend")]:
            self.step(name, [self.npm, "run", script])
        self.step("Pruebas Python", [self.python, self.api / "scripts/test_backend.py"])
        self.step("Cliente TypeScript", [self.node, "--experimental-strip-types", "--test", "API/sdk/typescript/tests/client.test.ts"])
        adapter = self.api / "integrations/nextjs"
        self.step("Tipos del adaptador Next.js", [self.npm, "run", "typecheck"], cwd=adapter)
        self.step("Pruebas del adaptador Next.js", [self.npm, "test"], cwd=adapter)
        self.step("Misiones completas Luna/Marte e integración Next.js", [self.python, self.api / "scripts/verify_backend.py",
                  "--scenario", "all", "--nextjs", "--output-dir", self.directory])
        if not quick:
            self.build()
            self.step("Preparar Chromium para las pruebas", [self.npm, "exec", "--", "playwright", "install", "chromium"])
            self.step("Pruebas en navegador: escritorio y móvil", [self.npm, "run", "test:e2e"],
                      env=self.env | {"PYTHON_EXECUTABLE": str(self.python)})
        print("\nPruebas aprobadas." + (" La comprobación rápida omite compilación y navegador." if quick else ""))

    def wait_ready(self, url, processes):
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if any(process.child.poll() is not None for process in processes):
                raise LauncherError("Un servicio terminó al arrancar. Revisa los archivos .log del informe.")
            try:
                with opener.open(url, timeout=1) as response:
                    if response.status == 200:
                        return response.read(1024 * 1024)
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.2)
        raise LauncherError("Un servicio no estuvo disponible en 90 segundos. Revisa los archivos .log del informe.")

    def serve(self, *, development=False, no_browser=False, smoke=False):
        require_free_ports([3000, 8000, 8001])
        self.runtimes()
        self.configs()
        self.snapshots()
        if development:
            # next dev escribe en .next: invalida la compilación previa de producción.
            (self.root / ".rockieos/build.json").unlink(missing_ok=True)
        elif not self.build_is_current():
            self.build()
        else:
            print("Se reutiliza la compilación actual; no se necesita descargar ni compilar.")
        env = self.env | {"ORBITA_API_URL": "http://127.0.0.1:8000", "APP_ORIGIN": APP_URL,
                          "MISSION_RESOURCE_API_URL": "http://127.0.0.1:8001"}
        if not development:
            env["RESOURCE_DATA_MODE"] = "snapshot"
        processes = []
        with contextlib.ExitStack() as stack:
            try:
                for name, command, cwd in [
                    ("backend", [self.python, self.api / "scripts/run_backend.py"], self.api),
                    ("frontend", [self.node, self.root / "node_modules/next/dist/bin/next",
                                  "dev" if development else "start", "--hostname", "127.0.0.1", "--port", "3000"], self.root),
                ]:
                    log = stack.enter_context((self.directory / f"{name}.log").open("w", encoding="utf-8"))
                    processes.append(Process(command, cwd=cwd, env=env, stdout=log))
                    if name == "backend":
                        self.wait_ready("http://127.0.0.1:8001/health/ready", processes)
                        self.wait_ready("http://127.0.0.1:8000/health/ready", processes)
                    else:
                        self.wait_ready(APP_URL + "/mision", processes)
                catalog = json.loads(self.wait_ready(APP_URL + "/api/mission/scenarios", processes))
                if not {"lunar-outpost-v1", "mars-outpost-v1"} <= {item["id"] for item in catalog}:
                    raise LauncherError("El backend conectado no ofrece ambas misiones: Luna y Marte.")
                print(f"\nRockieOS listo: {APP_URL}/mision\nBackend: http://127.0.0.1:8000/docs\n"
                      "Luna y Marte disponibles. Ctrl+C detiene los tres servicios.", flush=True)
                if smoke:
                    print("Arranque verificado; cerrando los servicios de prueba.", flush=True)
                    return
                if not no_browser:
                    webbrowser.open(APP_URL + "/mision")
                while True:
                    if any(process.child.poll() is not None for process in processes):
                        raise LauncherError("Un servicio se detuvo. Consulta los archivos .log del informe.")
                    time.sleep(0.3)
            except KeyboardInterrupt:
                print("\nCerrando RockieOS...", flush=True)
            finally:
                for process in reversed(processes):
                    process.stop()

    def check(self):
        self.runtimes()
        for path in [self.api / ".env", self.root / ".env.local"]:
            print(f"{path.relative_to(self.root)}: {'presente' if path.exists() else 'se creará al iniciar'}")
        self.snapshots()
        busy = occupied_ports([3000, 8000, 8001, 3100, 8700, 8701])
        print("Puertos ocupados: " + (", ".join(map(str, busy)) if busy else "ninguno"))
        print("Presentación compilada: " + ("actual" if self.build_is_current() else "se compilará al iniciar"))

    def report(self, status, message):
        data = {"action": self.action, "status": status, "message": message, "steps": self.steps,
                "note": "Las pruebas usan bases temporales. No se incluyen tokens, .env ni partidas."}
        (self.directory / "summary.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        rows = "".join(f'<tr><td>{html.escape(step["name"])}</td><td>{step["exit_code"]}</td>'
                       f'<td>{step["seconds"]}</td><td><a href="{step["log"]}">Registro</a></td></tr>' for step in self.steps)
        # Los registros de servidores existen sólo para las acciones de arranque.
        logs = " ".join(f'<a href="{name}.log">{name}</a>' for name in ("backend", "frontend") if (self.directory / f"{name}.log").exists())
        page = ('<!doctype html><html lang="es"><meta charset="utf-8"><title>RockieOS · Informe</title>'
                '<style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px;background:#101826;color:#eee}'
                'a{color:#5de2ff}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #465265}</style>'
                f'<h1>RockieOS · {html.escape(self.action)}</h1><p>Resultado: <strong>{status}</strong></p>'
                f'<p>{html.escape(message)}</p><table><tr><th>Comprobación</th><th>Salida</th><th>Segundos</th><th>Detalle</th></tr>'
                f'{rows}</table><p>{logs}</p><p>{html.escape(data["note"])}</p></html>')
        (self.directory / "index.html").write_text(page, encoding="utf-8")
        print(f"\nInforme: {self.directory.relative_to(self.root) / 'index.html'}", flush=True)

    def execute(self, args):
        self.action = args.action
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        self.directory = self.root / "reports/rockieos" / f"{stamp}-{self.action}"
        self.directory.mkdir(parents=True)
        self.steps = []
        status, message, code = "success", "Operación completada.", 0
        try:
            with project_lock(self.root):
                if args.action == "prepare":
                    self.prepare()
                elif args.action == "test":
                    self.test(args.quick)
                elif args.action == "check":
                    self.check()
                else:
                    self.serve(development=args.action == "dev", no_browser=args.no_browser, smoke=args.smoke)
        except KeyboardInterrupt:
            status, message, code = "interrupted", "Operación cancelada por el usuario.", 130
        except Exception as exc:
            status, message, code = "failure", str(exc), 1
            print(f"\nERROR: {message}", file=sys.stderr, flush=True)
        finally:
            self.report(status, message)
        return code


def latest_report(root, open_browser=True):
    reports = sorted((root / "reports/rockieos").glob("*/index.html"))
    if not reports:
        print("Todavía no hay informes. Ejecuta una operación del lanzador.")
        return
    print(reports[-1])
    if open_browser:
        webbrowser.open(reports[-1].as_uri())


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(description="RockieOS: presentación, desarrollo y pruebas desde un menú.")
    parser.add_argument("action", nargs="?", choices=["prepare", "present", "dev", "test", "check", "report"])
    parser.add_argument("--quick", action="store_true", help="Omitir compilación y navegador en test.")
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador automáticamente.")
    parser.add_argument("--smoke", action="store_true", help="Verificar arranque y detener servicios sin crear partidas.")
    args = parser.parse_args(argv)
    def interrupt(*_args):
        raise KeyboardInterrupt

    for name in ("SIGTERM", "SIGBREAK"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), interrupt)
    if args.action == "report":
        latest_report(ROOT, not args.no_browser)
        return 0
    if args.action:
        return Launcher().execute(args)
    actions = {"1": ("prepare", False), "2": ("present", False), "3": ("dev", False),
               "4": ("test", True), "5": ("test", False), "6": ("check", False)}
    while True:
        print("\nROCKIEOS · Centro de ejecución\n"
              "1. Preparar / actualizar dependencias (requiere internet)\n"
              "2. Iniciar presentación (backend real + capturas NASA)\n"
              "3. Iniciar desarrollo\n4. Pruebas rápidas (sin compilar ni navegador)\n"
              "5. Pruebas completas (incluye escritorio y móvil)\n6. Diagnóstico\n7. Abrir último informe\n0. Salir")
        try:
            choice = input("Opción: ").strip()
            if choice == "0":
                return 0
            if choice == "7":
                latest_report(ROOT)
            elif choice in actions:
                args.action, args.quick = actions[choice]
                Launcher().execute(args)
            else:
                print("Elige una opción entre 0 y 7.")
        except (KeyboardInterrupt, EOFError):
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
