const test = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest } = require("next/server");
const adapter = require("../.test-build/app/api/mission/[...path]/route.js");

function request(path, method = "GET", options = {}) {
  const headers = { ...(method !== "GET" ? { origin: "https://trainer.example" } : {}), ...options.headers };
  if (options.token) headers.cookie = `orbita_session=${options.token}`;
  return new NextRequest(`https://trainer.example/api/mission/${path}`, { method, headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body) });
}
function context(path) { return { params: Promise.resolve({ path: path.split("/") }) }; }

test.beforeEach(() => {
  process.env.ORBITA_API_URL = "http://backend:8000";
  process.env.APP_ORIGIN = "https://trainer.example";
  process.env.NODE_ENV = "production";
  delete process.env.ORBITA_PROXY_TOKEN;
});

test("sesión nueva usa cookie HttpOnly y oculta el token en JSON", async () => {
  global.fetch = async () => Response.json({ session_id: "player", access_token: "private-player-token",
    token_type: "Bearer", expires_at: "2030-01-01T00:00:00Z" }, { status: 201 });
  const response = await adapter.POST(request("sessions", "POST"), context("sessions"));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).access_token, undefined);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=strict/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("reutiliza sesión vigente al recargar sin crear otro jugador", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([String(url), init]);
    return Response.json({ session_id: "same-player" });
  };
  const response = await adapter.POST(request("sessions", "POST", { token: "existing" }), context("sessions"));
  assert.equal((await response.json()).session_id, "same-player");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "http://backend:8000/api/v1/sessions/me");
  assert.equal(calls[0][1].headers.Authorization, "Bearer existing");
});

test("rechaza origen ajeno antes de conectar con Python", async () => {
  global.fetch = async () => { throw new Error("No debe consultar"); };
  const response = await adapter.POST(request("sessions", "POST", { headers: { origin: "https://other.example" } }), context("sessions"));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "INVALID_ORIGIN");
});

test("reenvía cuerpo y clave usando el token de la cookie", async () => {
  let call;
  global.fetch = async (url, init) => { call = [url, init]; return Response.json({ mission: {} }); };
  const path = "missions/11111111-1111-4111-8111-111111111111/commands";
  const body = { type: "advance", expected_version: 4 };
  const response = await adapter.POST(request(path, "POST", { token: "real-player", body,
    headers: { "Idempotency-Key": "stable-key", Authorization: "Bearer spoofed-token", "Content-Type": "application/json" } }), context(path));
  assert.equal(response.status, 200);
  assert.equal(call[1].headers.Authorization, "Bearer real-player");
  assert.equal(call[1].headers["Idempotency-Key"], "stable-key");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(call[1].body)), body);
});

test("una sesión inválida borra la cookie y conserva el error de Python", async () => {
  global.fetch = async () => Response.json({ error: { code: "UNAUTHORIZED", request_id: "diagnostic" } },
    { status: 401, headers: { "X-Request-ID": "diagnostic" } });
  const response = await adapter.GET(request("sessions/me", "GET", { token: "expired" }), context("sessions/me"));
  assert.equal(response.status, 401);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
  assert.equal(response.headers.get("x-request-id"), "diagnostic");
  assert.equal((await response.json()).error.code, "UNAUTHORIZED");
});

test("logout maneja 204 sin intentar analizar JSON", async () => {
  global.fetch = async () => new Response(null, { status: 204 });
  const response = await adapter.DELETE(request("sessions/current", "DELETE", { token: "player" }), context("sessions/current"));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
});

test("rechaza segmentos de escape antes de construir la URL", async () => {
  const response = await adapter.GET(request("missions"), { params: Promise.resolve({ path: ["missions", "..", "internal"] }) });
  assert.equal(response.status, 400);
});

test("fallo temporal al validar sesión no crea otra sesión", async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({}, { status: 503 }); };
  const response = await adapter.POST(request("sessions", "POST", { token: "player" }), context("sessions"));
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test("detecta configuración incompleta", async () => {
  delete process.env.ORBITA_API_URL;
  const response = await adapter.GET(request("scenarios"), context("scenarios"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "PROXY_CONFIG_ERROR");
});

test("limita el cuerpo antes de reenviarlo", async () => {
  const response = await adapter.POST(request("missions", "POST", { body: { invalid: "x".repeat(17000) } }), context("missions"));
  assert.equal(response.status, 413);
});

test("un fallo de transporte no revela diagnósticos internos", async () => {
  global.fetch = async () => { throw new Error("private network diagnostic"); };
  const response = await adapter.GET(request("scenarios"), context("scenarios"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private network diagnostic/);
});


test("el proxy firma una identidad de visitante y descarta cabeceras falsas", async () => {
  const secret = "TEST-ONLY_proxy-token-p5rA8Nv2Wz6Lq0Uc1mT9Bf4Gd7Yh3";
  process.env.ORBITA_PROXY_TOKEN = secret;
  let headers;
  global.fetch = async (_url, init) => { headers = init.headers; return Response.json([]); };
  const first = await adapter.GET(request("scenarios", "GET", {headers:{"X-Orbita-Visitor":"spoofed", "X-Orbita-Proxy-Token":"spoofed"}}), context("scenarios"));
  assert.equal(first.status, 200);
  const id = headers["X-Orbita-Visitor"];
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(headers["X-Orbita-Proxy-Token"], secret);
  const cookie = first.cookies.get("orbita_visitor").value;
  await adapter.GET(request("scenarios", "GET", {headers:{cookie: "orbita_visitor=" + cookie}}), context("scenarios"));
  assert.equal(headers["X-Orbita-Visitor"], id);
  await adapter.GET(request("scenarios", "GET", {headers:{cookie: "orbita_visitor=" + id + "." + "0".repeat(64)}}), context("scenarios"));
  assert.notEqual(headers["X-Orbita-Visitor"], id);
  assert.match(first.headers.get("set-cookie"), /HttpOnly/i);
});
