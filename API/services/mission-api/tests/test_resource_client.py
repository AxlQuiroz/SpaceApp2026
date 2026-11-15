import unittest
from datetime import UTC, datetime

import httpx

from mission_api.errors import MissionError
from mission_api.resources import ResourceClient


def envelope(offset=0, more=False):
    return {"schema_version": "1.0", "data": [{"source_id": "reference"}], "meta": {
        "provider": "donki", "source_url": "https://example.nasa.gov/", "attribution": "NASA",
        "retrieval_mode": "snapshot", "retrieved_at": "2026-11-14T00:00:00Z", "delivered_at": "2026-11-14T00:00:00Z",
        "query": {}, "warnings": [], "pagination": {"total": 2 if more or offset else 1,
            "returned": 1, "limit": 1000, "offset": offset, "has_more": more}}}


class ResourceClientTests(unittest.IsolatedAsyncioTestCase):
    async def collect(self, handler, mode="snapshot"):
        async with httpx.AsyncClient(base_url="http://resource", transport=httpx.MockTransport(handler)) as client:
            return await ResourceClient(client)._collect("/weather", {"mode": mode}, "donki")

    async def test_collect_preserves_metadata_for_every_page(self):
        records, metas = await self.collect(lambda request: httpx.Response(200, json=envelope(int(request.url.params["offset"]), request.url.params["offset"] == "0")))
        self.assertEqual(len(records), 2)
        self.assertEqual(len(metas), 2)
        self.assertEqual([m["pagination"]["offset"] for m in metas], [0, 1])

    async def test_malformed_json_is_contract_error(self):
        with self.assertRaises(MissionError) as error:
            await self.collect(lambda request: httpx.Response(200, content=b"not-json"))
        self.assertEqual(error.exception.status, 502)

    async def test_empty_advancing_page_is_rejected(self):
        page = envelope(more=True)
        page["data"] = []
        page["meta"]["pagination"]["returned"] = 0
        with self.assertRaises(MissionError):
            await self.collect(lambda request: httpx.Response(200, json=page))

    async def test_wrong_provider_is_rejected(self):
        page = envelope()
        page["meta"]["provider"] = "osdr"
        with self.assertRaises(MissionError):
            await self.collect(lambda request: httpx.Response(200, json=page))

    async def test_redirect_never_follows_to_another_service(self):
        calls = []
        def redirect(request):
            calls.append(request.url)
            return httpx.Response(302, headers={"Location": "https://other.example"})
        with self.assertRaises(MissionError):
            await self.collect(redirect)
        self.assertEqual(len(calls), 1)

    async def test_timeout_is_dependency_failure(self):
        def timeout(request):
            raise httpx.ReadTimeout("private diagnostic", request=request)
        with self.assertRaises(MissionError) as error:
            await self.collect(timeout)
        self.assertEqual(error.exception.status, 503)
        self.assertNotIn("private diagnostic", error.exception.message)

    async def test_oversized_response_is_rejected(self):
        with self.assertRaises(MissionError) as error:
            await self.collect(lambda request: httpx.Response(200, content=b"x" * (2 * 1024 * 1024 + 1)))
        self.assertEqual(error.exception.code, "RESOURCE_CONTRACT_ERROR")

    async def test_changed_download_between_pages_is_rejected(self):
        def response(request):
            offset = int(request.url.params["offset"])
            page = envelope(offset, offset == 0)
            if offset:
                page["meta"]["retrieved_at"] = "2026-11-14T01:00:00Z"
            return httpx.Response(200, json=page)
        with self.assertRaises(MissionError) as error:
            await self.collect(response)
        self.assertEqual(error.exception.code, "RESOURCE_CONTRACT_ERROR")

    async def test_live_request_cannot_silently_receive_snapshot(self):
        with self.assertRaises(MissionError):
            await self.collect(lambda request: httpx.Response(200, json=envelope()), mode="live")


if __name__ == "__main__":
    unittest.main()
