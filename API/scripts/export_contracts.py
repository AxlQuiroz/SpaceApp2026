"""Exporta OpenAPI y tipos TS de sus esquemas. Sin red ni archivos de configuración."""
import json
import re
import secrets
from pathlib import Path

from mission_api.config import Settings
from mission_api.main import create_app


def ts_type(schema):
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    if "const" in schema:
        return json.dumps(schema["const"], ensure_ascii=False)
    if "enum" in schema:
        return " | ".join(json.dumps(v, ensure_ascii=False) for v in schema["enum"])
    for keyword in ["anyOf", "oneOf", "allOf"]:
        if keyword in schema:
            join = " & " if keyword == "allOf" else " | "
            return "(" + join.join(ts_type(s) for s in schema[keyword]) + ")"
    kind = schema.get("type")
    if kind == "array":
        return f"Array<{ts_type(schema.get('items', {}))}>"
    if kind == "object" or "properties" in schema:
        properties = schema.get("properties", {})
        if not properties:
            additional = schema.get("additionalProperties", True)
            return "Record<string, " + (ts_type(additional) if isinstance(additional, dict) else "unknown") + ">"
        required = schema.get("required", [])
        fields = []
        for name, value in properties.items():
            comment = value.get("description")
            if comment:
                fields.append("  /** " + comment.replace("*/", "* /").replace("\n", " ") + " */")
            fields.append(f"  {json.dumps(name)}{'' if name in required else '?'}: {ts_type(value)};")
        return "{\n" + "\n".join(fields) + "\n}"
    return {"string": "string", "integer": "number", "number": "number", "boolean": "boolean", "null": "null"}.get(kind, "unknown")


def main():
    root = Path(__file__).resolve().parents[1]
    settings = Settings(RESOURCE_API_TOKEN=secrets.token_urlsafe(40), _env_file=None)
    schema = create_app(settings).openapi()
    (root / "docs/mission-api-openapi.json").write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    destination = root / "sdk/typescript"
    destination.mkdir(parents=True, exist_ok=True)
    lines = ["// Generado por scripts/export_contracts.py. No editar a mano.\n"]
    for name, definition in sorted(schema["components"]["schemas"].items()):
        if not re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", name):
            raise ValueError("Nombre de esquema no compatible con TypeScript.")
        lines.append(f"export type {name} = {ts_type(definition)};\n")
    (destination / "schema.ts").write_text("\n".join(lines), encoding="utf-8")
    print("Contrato OpenAPI y tipos TypeScript actualizados.")


if __name__ == "__main__":
    main()
