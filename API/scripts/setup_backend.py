"""Crea configuración compartida sin sobrescribir tokens ni imprimir secretos."""
import secrets
from pathlib import Path

from dotenv import dotenv_values, set_key


def sync_proxy_configuration(root, target):
    values = dotenv_values(target)
    proxy_token = values.get("MISSION_PROXY_TOKEN") or ""
    if len(proxy_token) < 32 or len(set(proxy_token)) < 8 or proxy_token.startswith("REEMPLAZAR_"):
        proxy_token = secrets.token_urlsafe(40)
        set_key(str(target), "MISSION_PROXY_TOKEN", proxy_token)
    frontend = root.parent / ".env.local"
    example = root.parent / ".env.local.example"
    if not frontend.exists() and example.exists():
        try:
            with frontend.open("x", encoding="utf-8") as file:
                file.write(example.read_text(encoding="utf-8"))
        except FileExistsError:
            pass
    if frontend.exists():
        set_key(str(frontend), "ORBITA_PROXY_TOKEN", proxy_token)
        frontend.chmod(0o600)


def main():
    root = Path(__file__).resolve().parents[1]
    target = root / ".env"
    if target.exists():
        sync_proxy_configuration(root, target)
        print("Configuración conservada y conexión privada con Next.js preparada.")
        return
    previous = dotenv_values(root / "services/resource-api/.env").get("RESOURCE_API_TOKEN")
    token = previous if previous and len(previous) >= 32 and len(set(previous)) >= 8 and not previous.startswith("REEMPLAZAR_") else secrets.token_urlsafe(40)
    text = (root / ".env.example").read_text(encoding="utf-8").replace("REEMPLAZAR_POR_UN_TOKEN_ALEATORIO_DE_AL_MENOS_32_CARACTERES", token)
    try:
        with target.open("x", encoding="utf-8") as file:
            file.write(text)
        target.chmod(0o600)
    except FileExistsError:
        print("Otro proceso ya creó .env; no se modificó.")
        return
    sync_proxy_configuration(root, target)
    print("Configuración creada. Los dos servicios usarán el mismo token interno desde la raíz.")


if __name__ == "__main__":
    main()
