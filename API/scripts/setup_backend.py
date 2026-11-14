"""Crea configuración compartida sin sobrescribir tokens ni imprimir secretos."""
import secrets
from pathlib import Path

from dotenv import dotenv_values


def main():
    root = Path(__file__).resolve().parents[1]
    target = root / ".env"
    if target.exists():
        print("Ya existe .env en la raíz; se conservó. Revisa .env.example para añadir opciones nuevas.")
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
    print("Configuración creada. Los dos servicios usarán el mismo token interno desde la raíz.")


if __name__ == "__main__":
    main()
