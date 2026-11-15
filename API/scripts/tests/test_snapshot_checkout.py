import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("verify_snapshots", Path(__file__).resolve().parents[1] / "verify_snapshots.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CheckoutTests(unittest.TestCase):
    def fixture(self, root, content):
        original = b'{\n  "science": true\n}\n'
        (root / "data.json").write_bytes(content)
        (root / "manifest.json").write_text(json.dumps({"snapshots": [{"file": "data.json", "sha256": hashlib.sha256(original).hexdigest()}]}))
        return original

    def test_crlf_is_repaired_to_the_original_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = self.fixture(root, b'{\r\n  "science": true\r\n}\r\n')
            self.assertEqual(module.verify(root, repair=True), (1, ["data.json"]))
            self.assertEqual((root / "data.json").read_bytes(), original)

    def test_arbitrary_changes_are_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root, b'{"science":false}')
            with self.assertRaises(ValueError): module.verify(root, repair=True)
            self.assertEqual((root / "data.json").read_bytes(), b'{"science":false}')

    def test_check_only_does_not_change_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root, b'{\r\n  "science": true\r\n}\r\n')
            with self.assertRaises(ValueError): module.verify(root)
            self.assertIn(b'\r\n', (root / "data.json").read_bytes())
