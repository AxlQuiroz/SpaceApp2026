"""Crear configuración local una vez. Compatible con Windows, macOS y Linux."""
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / ".env"
text = (root / ".env.example").read_text(encoding="utf-8")
text = text.replace("REEMPLAZAR_POR_UN_TOKEN_ALEATORIO_DE_AL_MENOS_32_CARACTERES", secrets.token_urlsafe(40))
try:
    with target.open("x", encoding="utf-8") as file:
        file.write(text)
    target.chmod(0o600)
except FileExistsError:
    raise SystemExit("Ya existe .env; se conservó su contenido.")
print("Configuración creada. Usa el token de .env sólo desde el motor o desde Swagger Authorize.")
