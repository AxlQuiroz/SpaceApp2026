import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("setup_production", Path(__file__).resolve().parents[1] / "setup_production.py")
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)


class ProductionConfigurationTests(unittest.TestCase):
    def test_generates_independent_secrets_and_preserves_an_existing_installation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env.production"
            production.configure(path, "https://example.org")
            original = path.read_bytes()
            settings = dict(line.split("=", 1) for line in original.decode().splitlines())
            self.assertNotEqual(settings["RESOURCE_API_TOKEN"], settings["MISSION_PROXY_TOKEN"])
            self.assertGreaterEqual(len(settings["RESOURCE_API_TOKEN"]), 40)
            if os.name != "nt":
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                production.configure(path, "https://another.example.org")
            self.assertEqual(path.read_bytes(), original)

    def test_invalid_origins_do_not_create_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            for origin in ("https://example.org/", "https://user:secret@example.org", "https://example.org?a=b", "file:///tmp/example", "https://example.org:bad", "https://example.org\nEXTRA=value"):
                path = Path(directory) / ".env.production"
                with self.assertRaises(ValueError):
                    production.configure(path, origin)
                self.assertFalse(path.exists())
