"""La actualización local coordina el proxy sin perder la configuración del usuario."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from dotenv import dotenv_values

spec = importlib.util.spec_from_file_location("setup_backend", Path(__file__).resolve().parents[1] / "setup_backend.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class ProxySetupTests(unittest.TestCase):
    def test_preserves_existing_origin_resource_token_and_proxy_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "API"
            root.mkdir()
            target = root / ".env"
            target.write_text("RESOURCE_API_TOKEN=existing-private-resource-token\nMISSION_SESSION_HOURS=72\n")
            frontend = root.parent / ".env.local"
            frontend.write_text("APP_ORIGIN=http://example.test\nORBITA_API_URL=http://localhost:8000\n")
            setup.sync_proxy_configuration(root, target)
            api, ui = dotenv_values(target), dotenv_values(frontend)
            self.assertEqual(api["RESOURCE_API_TOKEN"], "existing-private-resource-token")
            self.assertEqual(api["MISSION_SESSION_HOURS"], "72")
            self.assertEqual(ui["APP_ORIGIN"], "http://example.test")
            self.assertEqual(api["MISSION_PROXY_TOKEN"], ui["ORBITA_PROXY_TOKEN"])
            self.assertNotEqual(api["MISSION_PROXY_TOKEN"], api["RESOURCE_API_TOKEN"])
            setup.sync_proxy_configuration(root, target)
            self.assertEqual(dotenv_values(target)["MISSION_PROXY_TOKEN"], api["MISSION_PROXY_TOKEN"])

    def test_backend_only_installation_does_not_create_a_frontend(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "API"
            root.mkdir()
            target = root / ".env"
            target.write_text("RESOURCE_API_TOKEN=existing\n")
            setup.sync_proxy_configuration(root, target)
            self.assertFalse((root.parent / ".env.local").exists())
