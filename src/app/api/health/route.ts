export const dynamic = "force-dynamic";

/** Estado mínimo del producto: nunca expone configuración, rutas internas ni secretos. */
export async function GET() {
  try {
    const response = await fetch(new URL("/health/ready", process.env.ORBITA_API_URL ?? "http://127.0.0.1:8000"), {
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (response.ok) return Response.json({ status: "ready", version: "0.4.0" });
  } catch { /* La disponibilidad del backend determina la del producto. */ }
  return Response.json({ status: "unavailable", version: "0.4.0" }, { status: 503 });
}
