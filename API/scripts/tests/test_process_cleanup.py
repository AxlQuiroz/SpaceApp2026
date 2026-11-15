"""La validación no deja servidores descendientes sujetando archivos en Windows."""
import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

scripts = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("verify_process_cleanup", scripts / "verify_backend.py")
verify = importlib.util.module_from_spec(spec)
sys.path.insert(0, str(scripts))
try:
    spec.loader.exec_module(verify)
finally:
    sys.path.pop(0)


class ProcessCleanupTests(unittest.TestCase):
    def test_windows_closes_the_owned_tree_before_waiting(self):
        child = Mock(pid=12345)
        child.poll.side_effect = [None, 0]
        with patch.object(verify.subprocess, "run") as run:
            verify.stop_processes([child], windows=True)
        self.assertEqual(run.call_args.args[0], ["taskkill", "/PID", "12345", "/T", "/F"])
        child.wait.assert_called_once_with(timeout=10)
        child.kill.assert_not_called()
        child.terminate.assert_not_called()

    def test_posix_forces_and_waits_a_slow_server(self):
        child = Mock(pid=12345)
        child.poll.return_value = None
        child.wait.side_effect = [subprocess.TimeoutExpired("uvicorn", 10), 0]
        verify.stop_processes([child], windows=False)
        child.terminate.assert_called_once()
        child.kill.assert_called_once()
        self.assertEqual(child.wait.call_count, 2)
