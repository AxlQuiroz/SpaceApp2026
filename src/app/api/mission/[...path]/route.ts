/** Adaptador para Next.js App Router. No contiene reglas del simulador ni claves NASA. */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const COOKIE = "orbita_session";
const VISITOR_COOKIE = "orbita_visitor";

function visitorIdentity(request: NextRequest, secret: string): string {
  const [candidate, signature] = (request.cookies.get(VISITOR_COOKIE)?.value ?? "").split(".");
  if (/^[a-f0-9-]{36}$/.test(candidate ?? "") && /^[a-f0-9]{64}$/.test(signature ?? "")) {
    const expected = createHmac("sha256", secret).update(candidate).digest();
    if (timingSafeEqual(expected, Buffer.from(signature, "hex"))) return candidate;
  }
  return randomUUID();
}

type Context = { params: Promise<{ path: string[] }> };

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

async function proxy(request: NextRequest, context: Context) {
  const configUrl = process.env.ORBITA_API_URL;
  const appOrigin = process.env.APP_ORIGIN;
  if (!configUrl || !appOrigin) return failure("PROXY_CONFIG_ERROR", "Configura ORBITA_API_URL y APP_ORIGIN en el servidor Next.js.", 503);
  let backend: URL;
  try {
    backend = new URL(configUrl);
    if (!["http:", "https:"].includes(backend.protocol) || backend.username || backend.password || backend.search || backend.hash || backend.pathname !== "/") throw new Error();
    if (new URL(appOrigin).origin !== appOrigin) throw new Error();
  } catch {
    return failure("PROXY_CONFIG_ERROR", "Revisa los orígenes configurados en el servidor.", 503);
  }
  if (request.method !== "GET" && request.headers.get("origin") !== appOrigin) {
    return failure("INVALID_ORIGIN", "El origen de la solicitud no está permitido.", 403);
  }
  const { path } = await context.params;
  if (!path.length || path.some(part => !/^[A-Za-z0-9-]+$/.test(part))) return failure("INVALID_PATH", "Ruta no permitida.", 400);
  const route = path.join("/");
  const allowed = /^(sessions(?:\/me|\/current)?|scenarios(?:\/[A-Za-z0-9-]+)?|missions(?:\/[A-Fa-f0-9-]+(?:\/(commands|preview|restart|events|science|evaluation))?)?)$/;
  if (!allowed.test(route)) return failure("INVALID_PATH", "Ruta no permitida.", 404);
  const proxySecret = process.env.ORBITA_PROXY_TOKEN ?? "";
  if (proxySecret && (proxySecret.length < 32 || new Set(proxySecret).size < 8 || proxySecret.startsWith("REEMPLAZAR_"))) {
    return failure("PROXY_CONFIG_ERROR", "Configura el secreto privado de conexión con Python.", 503);
  }
  const visitor = proxySecret ? visitorIdentity(request, proxySecret) : null;
  const token = request.cookies.get(COOKIE)?.value;
  const headers: Record<string, string> = {};
  if (visitor) {
    headers["X-Orbita-Proxy-Token"] = proxySecret;
    headers["X-Orbita-Visitor"] = visitor;
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const key = request.headers.get("Idempotency-Key");
  if (key) headers["Idempotency-Key"] = key;
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;
  let body: Uint8Array | undefined;
  if (request.method === "POST") {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 16384) { await reader.cancel(); return failure("BODY_TOO_LARGE", "El cuerpo de la solicitud es demasiado grande.", 413); }
        chunks.push(part.value);
      }
    }
    if (size) {
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    }
  }
  try {
    // Reutilizar la sesión existente evita perder partidas al recargar la interfaz.
    if (request.method === "POST" && route === "sessions" && token) {
      const current = await fetch(new URL("/api/v1/sessions/me", backend), { headers, cache: "no-store", signal: AbortSignal.timeout(10000), redirect: "error" });
      if (current.ok) return NextResponse.json(await current.json(), { headers: { "Cache-Control": "no-store" } });
      if (current.status !== 401) return failure("BACKEND_UNAVAILABLE", "No se pudo verificar la sesión existente.", 503);
      delete headers.Authorization;
    }
    const target = new URL(`/api/v1/${route}`, backend);
    target.search = request.nextUrl.search;
    const upstream = await fetch(target, { method: request.method, headers, body: body as BodyInit | undefined,
      cache: "no-store", signal: AbortSignal.timeout(90000), redirect: "error" });
    const result = upstream.status === 204 ? undefined : await upstream.json();
    let sessionToken: string | undefined;
    let expires: Date | undefined;
    if (request.method === "POST" && route === "sessions" && upstream.ok) {
      sessionToken = result.access_token;
      expires = new Date(result.expires_at);
      delete result.access_token;
      delete result.token_type;
    }
    const response = upstream.status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(result, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    for (const name of ["X-Request-ID", "ETag", "Retry-After"]) {
      const value = upstream.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    if (visitor) {
      const signature = createHmac("sha256", proxySecret).update(visitor).digest("hex");
      response.cookies.set(VISITOR_COOKIE, visitor + "." + signature,
        { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 604800 });
    }
    if (sessionToken) response.cookies.set(COOKIE, sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires });
    if ((request.method === "DELETE" && route === "sessions/current" && upstream.ok) || upstream.status === 401) {
      response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    }
    return response;
  } catch {
    return failure("BACKEND_UNAVAILABLE", "No se pudo conectar con el backend de misiones.", 503);
  }
}

export { proxy as GET, proxy as POST, proxy as DELETE };
