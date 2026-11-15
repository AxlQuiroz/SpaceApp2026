"""Ejecuta las dos suites aislando sus módulos de unittest."""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
for suite in ["services/resource-api/tests", "services/mission-api/tests", "scripts/tests"]:
    result = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", suite, "-v"], cwd=root)
    if result.returncode:
        raise SystemExit(result.returncode)
