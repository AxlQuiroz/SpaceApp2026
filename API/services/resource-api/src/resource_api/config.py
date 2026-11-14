from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RESOURCE_", extra="ignore", populate_by_name=True)

    api_token: SecretStr
    data_mode: Literal["live", "snapshot"] = "live"
    cache_path: Path = Path("data/resources.sqlite3")
    cache_ttl_seconds: int = Field(default=300, ge=1, le=86400)
    max_stale_seconds: int = Field(default=86400, ge=0, le=604800)
    cache_max_entries: int = Field(default=512, ge=1, le=10000)
    donki_gateway: Literal["ccmc", "api_nasa"] = "ccmc"
    nasa_api_key: SecretStr = Field(default=SecretStr(""), validation_alias="NASA_API_KEY")
    upstream_timeout_seconds: float = Field(default=15, ge=1, le=60)
    upstream_attempts: int = Field(default=3, ge=1, le=3)
    upstream_max_bytes: int = Field(default=8 * 1024 * 1024, ge=1024, le=32 * 1024 * 1024)

    @model_validator(mode="after")
    def validate_secrets(self):
        token = self.api_token.get_secret_value()
        if len(token) < 32 or token.startswith("REEMPLAZAR_") or len(set(token)) < 8:
            raise ValueError("RESOURCE_API_TOKEN requiere un token aleatorio de al menos 32 caracteres.")
        if self.donki_gateway == "api_nasa" and not self.nasa_api_key.get_secret_value():
            raise ValueError("NASA_API_KEY es obligatoria al usar api_nasa.")
        return self
