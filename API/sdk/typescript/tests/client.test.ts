import test from "node:test";
import assert from "node:assert/strict";
import { MissionApiClient, MissionApiError } from "../client.ts";

test("Next.js usa el proxy con cookies sin token de recursos", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const api = new MissionApiClient({ fetcher: (async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ session_id: "player", expires_at: "2026-11-21T00:00:00Z" });
  }) as typeof fetch });
  const session = await api.createSession();
  assert.equal(session.access_token, undefined);
  assert.equal(calls[0].url, "/api/mission/sessions");
  assert.equal(calls[0].init?.credentials, "same-origin");
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, undefined);
});

test("las mutaciones preservan la clave y versión enviadas", async () => {
  const calls: RequestInit[] = [];
  const api = new MissionApiClient({ baseUrl: "http://localhost:8000/api/v1/", token: "player-token",
    fetcher: (async (_url, init) => { calls.push(init!); return Response.json({}); }) as typeof fetch });
  const body = { type: "advance" as const, expected_version: 7 };
  const key = crypto.randomUUID();
  await api.command("mission", body, key);
  await api.command("mission", body, key);
  assert.equal((calls[0].headers as Record<string, string>)["Idempotency-Key"], key);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal((calls[0].headers as Record<string, string>).Authorization, "Bearer player-token");
  assert.equal(JSON.parse(String(calls[0].body)).expected_version, 7);
});

test("un conflicto entrega código e identificador de diagnóstico", async () => {
  const key = crypto.randomUUID();
  const api = new MissionApiClient({ fetcher: (async () => Response.json({ error: {
    code: "VERSION_CONFLICT", message: "Consulta el estado actual.", request_id: "request-123",
  } }, { status: 409 })) as typeof fetch });
  await assert.rejects(api.command("mission", { type: "advance", expected_version: 1 }, key), (error: unknown) => {
    assert.ok(error instanceof MissionApiError);
    assert.equal(error.code, "VERSION_CONFLICT");
    assert.equal(error.requestId, "request-123");
    assert.equal(error.idempotencyKey, key);
    return true;
  });
});

test("no reintenta automáticamente una mutación cuando falla la red", async () => {
  let attempts = 0;
  const key = crypto.randomUUID();
  const api = new MissionApiClient({ fetcher: (async () => { attempts++; throw new TypeError("network"); }) as typeof fetch });
  await assert.rejects(api.createMission({}, key), (error: unknown) => {
    assert.ok(error instanceof MissionApiError);
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(error.idempotencyKey, key);
    return true;
  });
  assert.equal(attempts, 1);
});

test("cerrar sesión admite 204 sin JSON", async () => {
  const api = new MissionApiClient({ fetcher: (async () => new Response(null, { status: 204 })) as typeof fetch });
  assert.equal(await api.logout(), undefined);
});

test("una respuesta 200 incompleta conserva la clave para un reintento seguro", async () => {
  const key = crypto.randomUUID();
  const api = new MissionApiClient({ fetcher: (async () => new Response("{", { status: 200 })) as typeof fetch });
  await assert.rejects(api.command("mission", { type: "advance", expected_version: 1 }, key), (error: unknown) => {
    assert.ok(error instanceof MissionApiError);
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(error.idempotencyKey, key);
    return true;
  });
});

test("conserva Retry-After para esperar antes del siguiente intento", async () => {
  const api = new MissionApiClient({ fetcher: (async () => Response.json({ error: { code: "RATE_LIMITED" } },
    { status: 429, headers: { "Retry-After": "30" } })) as typeof fetch });
  await assert.rejects(api.missions(), (error: unknown) => {
    assert.ok(error instanceof MissionApiError);
    assert.equal(error.retryAfter, 30);
    return true;
  });
});

test("sin fetcher propio usa el fetch global sin cambiarle el contexto (navegador)", async () => {
  // En el navegador, `window.fetch` lanza "Illegal invocation" si se llama como método de otro
  // objeto (this.fetcher(...)). Simulamos esa comprobación con un fetch global falso.
  const original = globalThis.fetch;
  globalThis.fetch = function (this: unknown) {
    if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
    return Promise.resolve(Response.json({ session_id: "player", expires_at: "2026-11-21T00:00:00Z" }));
  } as typeof fetch;
  try {
    const session = await new MissionApiClient().createSession();
    assert.equal(session.session_id, "player");
  } finally {
    globalThis.fetch = original;
  }
});

