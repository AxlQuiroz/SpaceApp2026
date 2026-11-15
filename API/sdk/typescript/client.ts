import type {
  Command, CreateMission, Evaluation, EventList, MissionList, MissionView,
  MutationResult, PreviewResult, ScienceBundle, SessionInfo,
} from "./schema";

export class MissionApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  idempotencyKey?: string;
  retryAfter?: number;

  constructor(message: string, status: number, code: string, requestId?: string, key?: string, retryAfter?: number) {
    super(message);
    this.name = "MissionApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.idempotencyKey = key;
    this.retryAfter = retryAfter;
  }
}

export type SessionResponse = SessionInfo & { access_token?: string; token_type?: "Bearer" };

/** Instancia por jugador. En React usa el proxy /api/mission; en Node puedes usar Bearer. */
export class MissionApiClient {
  private baseUrl: string;
  private token?: string;
  private fetcher: typeof fetch;

  constructor(options: { baseUrl?: string; token?: string; fetcher?: typeof fetch } = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/mission").replace(/\/$/, "");
    this.token = options.token;
    this.fetcher = options.fetcher ?? fetch;
  }

  private async request<T>(path: string, method = "GET", body?: unknown, key?: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (key) headers["Idempotency-Key"] = key;
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(90000),
      });
    } catch {
      throw new MissionApiError("No se pudo conectar con el backend. Conserva la clave al reintentar.", 0, "NETWORK_ERROR", undefined, key);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new MissionApiError(data.error?.message ?? "La solicitud falló.", response.status,
        data.error?.code ?? "HTTP_ERROR", data.error?.request_id ?? response.headers.get("X-Request-ID") ?? undefined,
        key, Number(response.headers.get("Retry-After")) || undefined);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async createSession(): Promise<SessionResponse> {
    const session = await this.request<SessionResponse>("/sessions", "POST");
    if (session.access_token) this.token = session.access_token;
    return session;
  }
  me(): Promise<SessionInfo> { return this.request("/sessions/me"); }
  async logout(): Promise<void> {
    await this.request("/sessions/current", "DELETE");
    this.token = undefined;
  }
  scenarios(): Promise<Array<Record<string, unknown>>> { return this.request("/scenarios"); }
  createMission(body: CreateMission = {}, key: string = crypto.randomUUID()): Promise<MutationResult> {
    return this.request("/missions", "POST", body, key);
  }
  missions(limit = 20, offset = 0): Promise<MissionList> { return this.request(`/missions?limit=${limit}&offset=${offset}`); }
  mission(id: string): Promise<MissionView> { return this.request(`/missions/${encodeURIComponent(id)}`); }
  command(id: string, command: Command, key: string = crypto.randomUUID()): Promise<MutationResult> {
    return this.request(`/missions/${encodeURIComponent(id)}/commands`, "POST", command, key);
  }
  preview(id: string, actionId: NonNullable<Command["action_id"]>, expectedVersion: number): Promise<PreviewResult> {
    return this.request(`/missions/${encodeURIComponent(id)}/preview`, "POST", { action_id: actionId, expected_version: expectedVersion });
  }
  restart(id: string, expectedVersion: number, key: string = crypto.randomUUID()): Promise<MutationResult> {
    return this.request(`/missions/${encodeURIComponent(id)}/restart`, "POST", { expected_version: expectedVersion }, key);
  }
  events(id: string, limit = 20, offset = 0): Promise<EventList> {
    return this.request(`/missions/${encodeURIComponent(id)}/events?limit=${limit}&offset=${offset}`);
  }
  science(id: string): Promise<ScienceBundle> { return this.request(`/missions/${encodeURIComponent(id)}/science`); }
  evaluation(id: string): Promise<Evaluation> { return this.request(`/missions/${encodeURIComponent(id)}/evaluation`); }
}
