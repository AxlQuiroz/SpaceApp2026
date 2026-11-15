"""Prepara secretos de Compose sin imprimirlos ni sobrescribir instalaciones existentes."""
import argparse
import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit


def configure(path: Path, origin: str):
    parsed = urlsplit(origin)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment or any(c.isspace() for c in origin)):
        raise ValueError("Usa un origen http(s) sin ruta, credenciales ni barra final.")
    try:
        parsed.port
    except ValueError:
        raise ValueError("El puerto no es válido.") from None
    # x + 0600: no reemplaza secretos ni deja una ventana de lectura para otros usuarios Unix.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(f"APP_ORIGIN={origin}\nRESOURCE_API_TOKEN={secrets.token_urlsafe(40)}\n"
                     f"MISSION_PROXY_TOKEN={secrets.token_urlsafe(40)}\nROCKIEOS_PORT=3000\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default="http://localhost:3000")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / ".env.production")
    args = parser.parse_args()
    try:
        configure(args.output, args.origin)
    except FileExistsError:
        parser.exit(1, "La configuración ya existe y se conservó. Edita APP_ORIGIN si cambia el dominio.\n")
    except (OSError, ValueError) as error:
        parser.exit(1, f"No se creó la configuración: {error}\n")
    print("Configuración preparada. Ejecuta: docker compose --env-file .env.production up --build -d")


if __name__ == "__main__":
    main()
