"""Verifica fallos, persistencia y cierre real de procesos, también en Windows."""
import argparse
import contextlib
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rockieos import Launcher, LauncherError, Process, build_fingerprint, project_lock, require_free_ports


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="RockieOS entrega ñ ")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "API").mkdir()
        (self.root / "src").mkdir()
        (self.root / "public").mkdir()

    def launcher(self):
        launcher = Launcher(self.root)
        launcher.directory = self.root / "reports/rockieos/test"
        launcher.directory.mkdir(parents=True, exist_ok=True)
        return launcher

    def test_busy_port_is_rejected_without_stopping_its_owner(self):
        with socket.socket() as owner:
            owner.bind(("127.0.0.1", 0))
            owner.listen()
            port = owner.getsockname()[1]
            with self.assertRaisesRegex(LauncherError, str(port)):
                require_free_ports([port])
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                pass

    def test_only_one_operation_can_use_the_checkout(self):
        with project_lock(self.root):
            with self.assertRaises(LauncherError):
                with project_lock(self.root):
                    self.fail("Un segundo lanzador adquirió el bloqueo")
        with project_lock(self.root):
            pass

    def test_config_and_database_are_preserved(self):
        launcher = self.launcher()
        existing = {".env.local": b"APP_ORIGIN=http://example.test\n", "API/.env": b"private\n",
                    "API/data/missions.sqlite3": b"existing database"}
        for name, content in existing.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        with patch.object(launcher, "step"):
            launcher.configs()
        for name, content in existing.items():
            self.assertEqual((self.root / name).read_bytes(), content)

    def test_first_start_copies_only_the_missing_frontend_configuration(self):
        launcher = self.launcher()
        (self.root / ".env.local.example").write_bytes(b"APP_ORIGIN=http://localhost:3000\n")
        with patch.object(launcher, "step"):
            launcher.configs()
        self.assertEqual((self.root / ".env.local").read_bytes(), (self.root / ".env.local.example").read_bytes())

    def test_source_and_public_changes_invalidate_production_build(self):
        source = self.root / "src/page.tsx"
        source.write_text("old")
        initial = build_fingerprint(self.root)
        # Ignorados: partidas e informes de pruebas.
        (self.root / "API/database.db").write_text("changed")
        self.assertEqual(initial, build_fingerprint(self.root))
        source.write_text("new")
        changed = build_fingerprint(self.root)
        self.assertNotEqual(initial, changed)
        (self.root / "public/asset.svg").write_text("sprite")
        self.assertNotEqual(changed, build_fingerprint(self.root))

    def test_failed_step_is_recorded_and_does_not_become_a_success(self):
        launcher = self.launcher()
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(LauncherError):
            launcher.step("Fallo simulado", [sys.executable, "-c", "print('diagnóstico'); raise SystemExit(7)"])
        self.assertEqual(launcher.steps[0]["exit_code"], 7)
        self.assertIn("diagnóstico", (launcher.directory / "01.log").read_text(encoding="utf-8"))

    def test_failure_stops_the_pipeline_and_creates_a_reviewable_report(self):
        launcher = Launcher(self.root)
        args = argparse.Namespace(action="test", quick=False, no_browser=True, smoke=False)
        with patch.object(launcher, "test", side_effect=LauncherError("Fallo controlado")), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            code = launcher.execute(args)
        report = json.loads((launcher.directory / "summary.json").read_text())
        self.assertEqual(code, 1)
        self.assertEqual(report["status"], "failure")
        self.assertIn("Fallo controlado", (launcher.directory / "index.html").read_text(encoding="utf-8"))

    def test_failed_build_invalidates_previous_marker(self):
        launcher = self.launcher()
        folder = self.root / ".rockieos"
        folder.mkdir()
        marker = folder / "build.json"
        marker.write_text("{}")
        with patch.object(launcher, "step", side_effect=LauncherError("Build falló")), self.assertRaises(LauncherError):
            launcher.build()
        self.assertFalse(marker.exists())

    def test_server_start_failure_still_stops_every_process_it_started(self):
        launcher = self.launcher()
        args = dict(development=False, no_browser=True, smoke=True)
        with patch.object(launcher, "runtimes"), patch.object(launcher, "configs"), patch.object(launcher, "snapshots"), \
                patch.object(launcher, "build_is_current", return_value=True), patch("rockieos.require_free_ports"), \
                patch("rockieos.Process") as process, patch.object(launcher, "wait_ready", side_effect=LauncherError("Backend caído")):
            with self.assertRaises(LauncherError):
                launcher.serve(**args)
            process.return_value.stop.assert_called_once()

    def test_presentation_uses_snapshots_and_checks_proxy_without_creating_a_session(self):
        launcher = self.launcher()
        catalog = b'[{"id":"lunar-outpost-v1"},{"id":"mars-outpost-v1"}]'
        with patch.object(launcher, "runtimes"), patch.object(launcher, "configs"), patch.object(launcher, "snapshots"), \
                patch.object(launcher, "build_is_current", return_value=True), patch("rockieos.require_free_ports"), \
                patch("rockieos.Process") as process, patch.object(launcher, "wait_ready", return_value=catalog) as ready:
            launcher.serve(no_browser=True, smoke=True)
            env = process.call_args_list[0].kwargs["env"]
            self.assertEqual(env["RESOURCE_DATA_MODE"], "snapshot")
            self.assertEqual(env["APP_ORIGIN"], "http://localhost:3000")
            self.assertEqual(ready.call_args.args[0], "http://localhost:3000/api/mission/scenarios")
            self.assertEqual(process.return_value.stop.call_count, 2)

    def test_stopping_a_process_releases_its_grandchild_port(self):
        # Un proceso secundario ocupa un puerto; el cierre debe eliminarlo también.
        address = self.root / "port.txt"
        worker = self.root / "nieto con espacios.py"
        worker.write_text("import socket,sys,time\nfrom pathlib import Path\n"
                          "s=socket.socket(); s.bind(('127.0.0.1',0)); s.listen()\n"
                          "Path(sys.argv[1]).write_text(str(s.getsockname()[1]))\ntime.sleep(120)\n")
        parent = self.root / "padre.py"
        parent.write_text("import subprocess,sys,time\nsubprocess.Popen(sys.argv[1:])\ntime.sleep(120)\n")
        process = Process([sys.executable, parent, sys.executable, worker, address],
                          cwd=self.root, env=os.environ.copy(), stdout=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 15
            while not address.exists() and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertTrue(address.exists(), "El nieto no arrancó")
            port = int(address.read_text())
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                pass
        finally:
            process.stop()
        require_free_ports([port])


if __name__ == "__main__":
    unittest.main()
