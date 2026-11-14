import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path


class SQLiteCache:
    """Caché compartida entre reinicios/procesos; cada operación usa su conexión."""

    def __init__(self, path: Path, max_entries: int = 512):
        self.path = path
        self.max_entries = max_entries
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("CREATE TABLE IF NOT EXISTS resources (key TEXT PRIMARY KEY, created_at REAL NOT NULL, payload TEXT NOT NULL)")

    @contextmanager
    def _connect(self):
        connection = sqlite3.connect(self.path, timeout=5)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def get(self, key: str):
        with self._connect() as connection:
            row = connection.execute("SELECT created_at, payload FROM resources WHERE key = ?", (key,)).fetchone()
        if row is None:
            return None
        try:
            value = json.loads(row[1])
            if not isinstance(value, dict) or not isinstance(value["data"], list):
                return None
            if not isinstance(value["warnings"], list) or not isinstance(value["retrieved_at"], str):
                return None
            return row[0], value
        except (ValueError, KeyError, TypeError):
            return None

    def put(self, key: str, created_at: float, payload: dict):
        value = json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        with self._connect() as connection:
            connection.execute("INSERT OR REPLACE INTO resources (key, created_at, payload) VALUES (?, ?, ?)", (key, created_at, value))
            connection.execute("DELETE FROM resources WHERE key NOT IN (SELECT key FROM resources ORDER BY created_at DESC LIMIT ?)", (self.max_entries,))

    def ready(self) -> bool:
        try:
            with self._connect() as connection:
                connection.execute("SELECT key FROM resources LIMIT 1").fetchone()
                return True
        except sqlite3.Error:
            return False
