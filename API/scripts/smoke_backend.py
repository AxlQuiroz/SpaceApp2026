"""Prueba HTTP de una misión completa contra ambos procesos encendidos."""
import argparse
import json
from pathlib import Path
from uuid import uuid4

import httpx


def run(base_url: str, data_mode: str):
    with httpx.Client(base_url=base_url, timeout=100) as client:
        client.get("/health/ready").raise_for_status()
        session = client.post("/api/v1/sessions")
        session.raise_for_status()
        client.headers["Authorization"] = "Bearer " + session.json()["access_token"]

        def mutate(path, body, key=None):
            response = client.post(path, json=body, headers={"Idempotency-Key": key or str(uuid4())})
            response.raise_for_status()
            return response.json()

        result = mutate("/api/v1/missions", {"data_mode": data_mode, "seed": 42})
        state = result["mission"]["state"]
        mission_path = f'/api/v1/missions/{state["id"]}'
        preview = client.post(mission_path + "/preview", json={"action_id": "explore", "expected_version": state["version"]})
        preview.raise_for_status()
        assert preview.json()["persisted"] is False

        def command(kind="advance", action=None, key=None):
            nonlocal state
            body = {"type": kind, "expected_version": state["version"]}
            if action:
                body["action_id"] = action
            result = mutate(mission_path + "/commands", body, key)
            state = result["mission"]["state"]
            return result, body

        command("action", "explore")
        command("action", "explore")
        repeat_key = str(uuid4())
        original, original_body = command(key=repeat_key)
        assert mutate(mission_path + "/commands", original_body, repeat_key) == original
        for turn in range(1, 12):
            action = {2: "repair_water_loop", 5: "enter_shelter", 6: "leave_shelter", 8: "repair_solar_panels"}.get(turn)
            if action:
                command("action", action)
            command()
        evaluation = client.get(mission_path + "/evaluation")
        evaluation.raise_for_status()
        assert evaluation.json()["outcome"] == "success"
        science = client.get(mission_path + "/science")
        science.raise_for_status()
        assert len(science.json()["sources"]) == 3
        summary = {"mode": data_mode, "mission_id": state["id"], "turns": state["turn"],
                   "outcome": evaluation.json()["outcome"], "score": evaluation.json()["score"],
                   "sources": [{"id": s["id"], "records": len(s["records"]), "retrieval_modes": sorted({m["retrieval_mode"] for m in s["pages_meta"]})} for s in science.json()["sources"]]}
        client.delete("/api/v1/sessions/current").raise_for_status()
        return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--data-mode", choices=["snapshot", "live"], default="snapshot")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    summary = run(args.base_url, args.data_mode)
    text = json.dumps(summary, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)
