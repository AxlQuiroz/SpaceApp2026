import asyncio
import json
import sqlite3
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import httpx
from pydantic import ValidationError

from resource_api.cache import SQLiteCache
from resource_api.config import Settings
from resource_api.errors import ResourceError
from resource_api.main import create_app
from resource_api.snapshot_store import SnapshotStore

TOKEN = "tests-only-token-0123456789-ABCDEFGHIJKLMNOP"
WEATHER = {"start": "2024-05-10", "end": "2024-05-10"}
RADIATION = {"start": "2014-01-01T00:00:00Z", "end": "2014-01-01T01:00:00Z", "instrument": "CRaTER"}


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.snapshots = SnapshotStore()
        self.calls = []
        self.handler = self.real_fixture_response
        self.settings = Settings(api_token=TOKEN, cache_path=Path(self.tmp.name) / "cache.db", upstream_attempts=1, _env_file=None)

        async def dispatch(request):
            self.calls.append(request)
            result = self.handler(request)
            return await result if hasattr(result, "__await__") else result

        self.app = create_app(self.settings, transport=httpx.MockTransport(dispatch))
        self.lifespan = self.app.router.lifespan_context(self.app)
        await self.lifespan.__aenter__()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://testserver",
                                       headers={"Authorization": f"Bearer {TOKEN}"})

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.lifespan.__aexit__(None, None, None)
        self.tmp.cleanup()

    def fixture(self, name):
        return json.loads(self.snapshots.root.joinpath(name + ".json").read_text(encoding="utf-8"))

    def real_fixture_response(self, request):
        path = request.url.path
        if "/DONKI/" in path:
            return httpx.Response(200, json=self.fixture("donki-" + path.rsplit("/", 1)[1].lower() + "-2024-05-10"))
        if "/radlab/" in path:
            return httpx.Response(200, json=self.fixture("radlab-crater-2014-01-01"))
        return httpx.Response(200, json=self.fixture("osdr-104"))

    async def weather(self, **overrides):
        return await self.client.get("/internal/v1/space-weather", params=WEATHER | overrides)

    async def test_health_without_token_or_upstream(self):
        for path in ("/health/live", "/health/ready"):
            response = await self.client.get(path, headers={"Authorization": ""})
            self.assertEqual(response.status_code, 200)
        self.assertFalse(self.calls)

    async def test_missing_and_wrong_token(self):
        for auth in ("", "Bearer wrong", "Basic abc", "Bearer ñññ"):
            with self.subTest(auth=auth):
                # Los encabezados HTTP son bytes; el valor no ASCII se ensaya como UTF-8.
                response = await self.client.get("/internal/v1/catalog", headers={"Authorization": auth.encode()})
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")
                self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertFalse(self.calls)

    async def test_catalog_marks_planned_providers(self):
        response = await self.client.get("/internal/v1/catalog")
        values = {p["provider"]: p["status"] for p in response.json()["resources"]}
        self.assertEqual(values["donki"], "implemented")
        self.assertEqual(values["mars_trek"], "planned")
        self.assertEqual(values["csa"], "planned")

    async def test_openapi_contains_typed_contract_and_security(self):
        schema = (await self.client.get("/openapi.json")).json()
        route = schema["paths"]["/internal/v1/space-weather"]["get"]
        self.assertEqual(route["security"], [{"ServiceToken": []}])
        self.assertNotIn(TOKEN, json.dumps(schema))
        self.assertIn("RadiationReading", schema["components"]["schemas"])
        self.assertEqual(route["responses"]["422"]["content"]["application/json"]["schema"]["$ref"],
                         "#/components/schemas/ErrorResponse")

    async def test_live_flare_and_cache_with_pagination(self):
        first = await self.weather(limit=2)
        second = await self.weather(limit=2, offset=2)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["meta"]["retrieval_mode"], "live")
        self.assertEqual(second.json()["meta"]["retrieval_mode"], "cache")
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(first.json()["meta"]["pagination"]["total"], 15)
        self.assertTrue(first.json()["meta"]["pagination"]["has_more"])
        self.assertNotEqual(first.json()["data"][0]["source_id"], second.json()["data"][0]["source_id"])
        self.assertIn("X-Request-ID", first.headers)
        self.assertEqual(first.headers["cache-control"], "no-store")

    async def test_all_donki_types_have_valid_contracts(self):
        for kind in ("FLR", "CME", "SEP", "GST"):
            with self.subTest(kind=kind):
                response = await self.weather(event_type=kind)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertTrue(response.json()["data"])
                self.assertTrue(all(r["event_type"] == kind for r in response.json()["data"]))

    async def test_historical_snapshot_is_explicit_and_contains_x39(self):
        response = await self.weather(mode="snapshot")
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["meta"]["retrieval_mode"], "snapshot")
        self.assertEqual(len(body["meta"]["snapshot_sha256"]), 64)
        self.assertTrue(any(r["classification"] == "X3.9" for r in body["data"]))
        self.assertFalse(self.calls)

    async def test_snapshot_never_contaminates_live_cache(self):
        await self.weather(mode="snapshot")
        response = await self.weather(mode="live")
        self.assertEqual(response.json()["meta"]["retrieval_mode"], "live")
        self.assertEqual(len(self.calls), 1)

    async def test_snapshot_requires_exact_query(self):
        response = await self.weather(start="2024-05-09", mode="snapshot")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "SNAPSHOT_NOT_FOUND")
        self.assertFalse(self.calls)

    async def test_snapshot_catalog_has_six_verified_captures(self):
        body = (await self.client.get("/internal/v1/snapshots")).json()
        self.assertEqual(len(body["snapshots"]), 6)
        for entry in body["snapshots"]:
            self.snapshots.read(entry["resource"], entry["query"])

    async def test_snapshot_integrity_failure_is_an_error(self):
        self.app.state.resources.snapshots.entries[0]["sha256"] = "invalid"
        response = await self.weather(mode="snapshot")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error"]["code"], "SNAPSHOT_INTEGRITY_FAILED")

    async def test_invalid_weather_queries_do_not_reach_nasa(self):
        cases = [dict(start="2024-05-11"), dict(end="2024-07-01"), dict(event_type="XXX"),
                 dict(start="bad"), dict(limit=1001), dict(offset=-1), dict(unexpected="value"),
                 dict(end="2999-01-01"), dict(mode="random")]
        for params in cases:
            with self.subTest(params=params):
                response = await self.weather(**params)
                self.assertEqual(response.status_code, 422, response.text)
                self.assertEqual(response.json()["error"]["code"], "INVALID_REQUEST")
        self.assertFalse(self.calls)

    async def test_radlab_preserves_units_nulls_and_orbit(self):
        response = await self.client.get("/internal/v1/radiation", params=RADIATION)
        self.assertEqual(response.status_code, 200, response.text)
        reading = response.json()["data"][0]
        self.assertEqual(reading["trajectory"], "Lunar orbit")
        self.assertEqual(reading["celestial_body"], "Moon")
        self.assertEqual(len(reading["measurements"]), 1)
        self.assertEqual(reading["measurements"][0]["unit"], "uGy/h")
        self.assertAlmostEqual(reading["measurements"][0]["value"], 7.7825)
        query = dict(self.calls[0].url.params)
        self.assertIn("timestamp<2014-01-01T01:00:00)", query["query"])
        self.assertNotIn("00Z", query["query"])
        self.assertEqual(response.json()["meta"]["query"]["end"], RADIATION["end"])
        self.assertIn("dose_equivalent_rate", query["fields"])

    async def test_radlab_dual_measurements_are_not_converted(self):
        payload = self.fixture("radlab-crater-2014-01-01")
        payload["data"][0][payload["columns"].index("dose_equivalent_rate")] = 42.5
        self.handler = lambda req: httpx.Response(200, json=payload)
        response = await self.client.get("/internal/v1/radiation", params=RADIATION)
        measurements = response.json()["data"][0]["measurements"]
        self.assertEqual([m["unit"] for m in measurements], ["uGy/h", "uSv/h"])
        self.assertEqual(measurements[1]["value"], 42.5)

    async def test_radlab_missing_measurements_are_not_zero(self):
        payload = self.fixture("radlab-crater-2014-01-01")
        payload["data"][0][payload["columns"].index("absorbed_dose_rate")] = None
        self.handler = lambda req: httpx.Response(200, json=payload)
        response = await self.client.get("/internal/v1/radiation", params=RADIATION)
        self.assertEqual(response.json()["data"][0]["measurements"], [])
        self.assertTrue(any("cero" in w for w in response.json()["meta"]["warnings"]))

    async def test_invalid_radiation_queries_do_not_reach_nasa(self):
        for params in ({"start": "2014-01-01T00:00:00"}, {"end": "2014-01-03T01:00:00Z"},
                       {"end": RADIATION["start"]}, {"instrument": "CRaTER')OR(1=1"}):
            response = await self.client.get("/internal/v1/radiation", params=RADIATION | params)
            self.assertEqual(response.status_code, 422, response.text)
        self.assertFalse(self.calls)

    async def test_radlab_schema_changes_do_not_become_empty_data(self):
        self.handler = lambda req: httpx.Response(200, json={"unexpected": []})
        response = await self.client.get("/internal/v1/radiation", params=RADIATION)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "UPSTREAM_SCHEMA_CHANGED")

    async def test_radlab_rejects_negative_nan_duplicate_and_out_of_range(self):
        for invalid in ("negative", "nan", "duplicate", "outside", "short_row"):
            with self.subTest(invalid=invalid):
                payload = self.fixture("radlab-crater-2014-01-01")
                index = payload["columns"].index("absorbed_dose_rate")
                if invalid == "negative": payload["data"][0][index] = -1
                if invalid == "nan": payload["data"][0][index] = "NaNish"
                if invalid == "duplicate": payload["data"].append(payload["data"][0])
                if invalid == "outside": payload["data"][0][0] = RADIATION["end"]
                if invalid == "short_row": payload["data"][0].pop()
                self.handler = lambda req: httpx.Response(200, json=payload)
                response = await self.client.get("/internal/v1/radiation", params=RADIATION)
                self.assertEqual(response.status_code, 502, response.text)

    async def test_osdr_summary_resolves_organism_reference_and_publications(self):
        response = await self.client.get("/internal/v1/studies/104")
        self.assertEqual(response.status_code, 200, response.text)
        study = response.json()["data"][0]
        self.assertEqual(study["source_id"], "OSD-104")
        self.assertEqual(study["organisms"], ["Mus musculus"])
        self.assertTrue(study["publications"][0]["doi"])
        self.assertIn("Mouse soleus", study["title"])

    async def test_osdr_not_found_is_404(self):
        self.handler = lambda req: httpx.Response(200, json={"hits": 0})
        response = await self.client.get("/internal/v1/studies/999999")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "RESOURCE_NOT_FOUND")

    async def test_osdr_id_mismatch_fails(self):
        response = await self.client.get("/internal/v1/studies/105")
        self.assertEqual(response.status_code, 502)

    async def test_empty_donki_is_distinct_from_provider_failure(self):
        for value in (None, []):
            self.handler = lambda req: httpx.Response(200, content=json.dumps(value))
            response = await self.weather(event_type="SEP" if value is None else "FLR")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["data"], [])
            self.assertTrue(response.json()["meta"]["warnings"])

    async def test_429_does_not_retry_and_honors_retry_after(self):
        self.settings.upstream_attempts = 3
        self.handler = lambda req: httpx.Response(429, headers={"Retry-After": "120"})
        response = await self.weather()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers["retry-after"], "120")
        self.assertEqual(len(self.calls), 1)

    async def test_transient_errors_retry_but_auth_errors_do_not(self):
        self.settings.upstream_attempts = 3
        self.handler = lambda req: httpx.Response(503)
        with patch("resource_api.transport.asyncio.sleep", return_value=None):
            response = await self.weather()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(self.calls), 3)
        self.calls.clear()
        self.handler = lambda req: httpx.Response(403, text="secret from provider")
        response = await self.weather()
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(response.json()["error"]["code"], "UPSTREAM_AUTH_FAILED")
        self.assertNotIn("secret from provider", response.text)

    async def test_timeout_has_stable_504_error(self):
        def timeout(request):
            raise httpx.ReadTimeout("https://nasa.example/?api_key=SECRET", request=request)
        self.handler = timeout
        response = await self.weather()
        self.assertEqual(response.status_code, 504)
        self.assertNotIn("SECRET", response.text)

    async def test_upstream_route_404_is_not_empty_collection(self):
        self.handler = lambda req: httpx.Response(404)
        response = await self.weather()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "UPSTREAM_NOT_FOUND")

    async def test_redirect_is_not_followed(self):
        self.handler = lambda req: httpx.Response(302, headers={"Location": "https://example.com"})
        response = await self.weather()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(len(self.calls), 1)

    async def test_invalid_json_and_oversized_responses(self):
        self.handler = lambda req: httpx.Response(200, content=b'{"value": NaN}')
        response = await self.weather()
        self.assertEqual(response.json()["error"]["code"], "UPSTREAM_INVALID_JSON")
        self.settings.upstream_max_bytes = 1024
        self.handler = lambda req: httpx.Response(200, content=b"x" * 1025)
        response = await self.weather()
        self.assertEqual(response.json()["error"]["code"], "UPSTREAM_RESPONSE_TOO_LARGE")

    async def test_stale_cache_is_explicit_and_has_an_age_limit(self):
        await self.weather()
        service = self.app.state.resources
        fetched = datetime.now(UTC)
        service.now = lambda: fetched + timedelta(seconds=400)
        self.handler = lambda req: httpx.Response(503)
        response = await self.weather()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["meta"]["retrieval_mode"], "stale_cache")
        self.assertEqual((await self.weather(allow_stale=False)).status_code, 503)
        service.now = lambda: fetched + timedelta(days=2)
        self.assertEqual((await self.weather()).status_code, 503)

    async def test_nontransient_schema_change_never_uses_stale_cache(self):
        await self.weather()
        self.app.state.resources.now = lambda: datetime.now(UTC) + timedelta(seconds=400)
        self.handler = lambda req: httpx.Response(200, json={"error": "changed"})
        response = await self.weather()
        self.assertEqual(response.status_code, 502)

    async def test_live_failure_does_not_silently_switch_to_bundled_history(self):
        self.handler = lambda req: httpx.Response(503)
        response = await self.weather()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("data", response.json())

    async def test_concurrent_identical_queries_share_upstream_call(self):
        async def delayed(request):
            await asyncio.sleep(0.02)
            return self.real_fixture_response(request)
        self.handler = delayed
        responses = await asyncio.gather(*(self.weather() for _ in range(6)))
        self.assertTrue(all(response.status_code == 200 for response in responses))
        self.assertEqual(len(self.calls), 1)

    async def test_gateway_key_not_in_metadata_cache_or_errors(self):
        self.settings.donki_gateway = "api_nasa"
        self.settings.nasa_api_key = self.settings.api_token.__class__("secret-nasa-key")
        response = await self.weather()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.calls[0].url.params["api_key"], "secret-nasa-key")
        self.assertNotIn("secret-nasa-key", response.text)
        self.assertNotIn("api_key", response.json()["meta"]["source_url"])
        with sqlite3.connect(self.settings.cache_path) as connection:
            raw = connection.execute("SELECT payload FROM resources").fetchone()[0]
        self.assertNotIn("secret-nasa-key", raw)

    async def test_cache_corrupt_json_fetches_again(self):
        await self.weather()
        with sqlite3.connect(self.settings.cache_path) as connection:
            connection.execute("UPDATE resources SET payload = 'invalid'")
        response = await self.weather()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.calls), 2)

    async def test_cache_write_failure_preserves_successful_data(self):
        with patch.object(self.app.state.resources.cache, "put", side_effect=sqlite3.OperationalError):
            response = await self.weather()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any("caché" in w for w in response.json()["meta"]["warnings"]))


class ConfigurationAndCacheTests(unittest.TestCase):
    def test_default_and_example_tokens_are_rejected(self):
        for token in ("short", "x" * 40, "REEMPLAZAR_POR_UN_TOKEN_ALEATORIO_DE_AL_MENOS_32_CARACTERES"):
            with self.subTest(token=token), self.assertRaises(ValidationError):
                Settings(api_token=token, _env_file=None)

    def test_api_nasa_gateway_requires_key(self):
        with self.assertRaises(ValidationError):
            Settings(api_token=TOKEN, donki_gateway="api_nasa", nasa_api_key="", _env_file=None)

    def test_cache_persists_and_bounds_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.db"
            cache = SQLiteCache(path, max_entries=2)
            payload = {"data": [], "warnings": [], "retrieved_at": "2024-05-10T00:00:00Z"}
            for i in range(3):
                cache.put(str(i), i, payload)
            reopened = SQLiteCache(path, max_entries=2)
            self.assertIsNone(reopened.get("0"))
            self.assertEqual(reopened.get("2")[1], payload)


if __name__ == "__main__":
    unittest.main()
