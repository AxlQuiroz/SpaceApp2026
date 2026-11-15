/** Integración real: Route Handler Next.js -> API Python -> servicio de recursos. */
const assert = require("node:assert/strict");
const { NextRequest } = require("next/server");
const adapter = require("../.test-build/app/api/mission/[...path]/route.js");

async function main() {
  process.env.ORBITA_API_URL = process.argv[2];
  process.env.APP_ORIGIN = "http://localhost:3000";
  let token;
  async function call(path, method = "GET", body, key) {
    const headers = { origin: "http://localhost:3000" };
    if (token) headers.cookie = `orbita_session=${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (key) headers["Idempotency-Key"] = key;
    const request = new NextRequest(`http://localhost:3000/api/mission/${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const response = await adapter[method](request, { params: Promise.resolve({ path: path.split("/") }) });
    const data = response.status === 204 ? null : await response.json();
    assert.ok(response.ok, JSON.stringify({ status: response.status, data }));
    const cookie = response.cookies.get("orbita_session");
    if (cookie) token = cookie.value || undefined;
    return { response, data };
  }
  const created = await call("sessions", "POST");
  assert.equal(created.data.access_token, undefined);
  assert.match(created.response.headers.get("set-cookie"), /HttpOnly/i);
  const repeatedSession = await call("sessions", "POST");
  assert.equal(repeatedSession.data.session_id, created.data.session_id);
  let result = await call("missions", "POST", { data_mode: "snapshot", seed: 42 }, crypto.randomUUID());
  let state = result.data.mission.state;
  const path = `missions/${state.id}`;
  async function command(type = "advance", action_id) {
    const body = { type, expected_version: state.version };
    if (action_id) body.action_id = action_id;
    const key = crypto.randomUUID();
    const applied = await call(`${path}/commands`, "POST", body, key);
    const replayed = await call(`${path}/commands`, "POST", body, key);
    assert.deepEqual(replayed.data, applied.data);
    state = applied.data.mission.state;
  }
  await command("action", "explore");
  await command("action", "explore");
  for (let turn = 0; turn < 12; turn++) {
    const action = { 2: "repair_water_loop", 5: "enter_shelter", 6: "leave_shelter", 8: "repair_solar_panels" }[turn];
    if (action) await command("action", action);
    await command();
  }
  const evaluation = (await call(`${path}/evaluation`)).data;
  assert.equal(evaluation.outcome, "success");
  assert.equal((await call(`${path}/science`)).data.sources.length, 3);
  assert.equal((await call(`${path}/events`)).data.total > 12, true);
  await call("sessions/current", "DELETE");
  assert.equal(token, undefined);
  console.log(JSON.stringify({ integration: "nextjs-app-router", turns: state.turn,
    outcome: evaluation.outcome, score: evaluation.score, cookie_http_only: true }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
