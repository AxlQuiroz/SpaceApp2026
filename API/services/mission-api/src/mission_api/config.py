from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MISSION_", extra="ignore")

    database_path: Path = Path("data/missions.sqlite3")
    resource_api_url: str = "http://127.0.0.1:8001"
    resource_api_token: SecretStr = Field(validation_alias="RESOURCE_API_TOKEN")
    allow_internal_http: bool = False
    resource_timeout_seconds: float = Field(default=60, ge=1, le=120)
    session_hours: int = Field(default=168, ge=1, le=720)
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "[::1]"]
    requests_per_minute: int = Field(default=300, ge=1, le=10000)
    sessions_per_hour: int = Field(default=20, ge=1, le=1000)
    max_body_bytes: int = Field(default=16384, ge=1024, le=1048576)
    max_active_missions_per_session: int = Field(default=20, ge=1, le=100)

    @model_validator(mode="after")
    def validate_configuration(self):
        url = urlsplit(self.resource_api_url)
        if (url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
                or url.query or url.fragment or url.path not in {"", "/"}):
            raise ValueError("MISSION_RESOURCE_API_URL debe ser un origen HTTP(S) sin credenciales ni ruta.")
        if url.scheme == "http" and url.hostname not in {"localhost", "127.0.0.1", "::1"} and not self.allow_internal_http:
            raise ValueError("El servicio remoto requiere HTTPS; HTTP interno sólo se habilita en una red privada.")
        token = self.resource_api_token.get_secret_value()
        if len(token) < 32 or len(set(token)) < 8 or token.startswith("REEMPLAZAR_"):
            raise ValueError("Configura RESOURCE_API_TOKEN con un token aleatorio de al menos 32 caracteres.")
        for origin in self.cors_origins:
            parsed = urlsplit(origin)
            if (origin == "*" or parsed.scheme not in {"https", "http"} or not parsed.hostname
                    or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment):
                raise ValueError("CORS requiere orígenes explícitos sin rutas ni comodines.")
        return self
