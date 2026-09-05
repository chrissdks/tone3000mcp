import { TtlCache } from "./cache.js";
import { Tone3000Error } from "./errors.js";
import type {
  PaginatedResponse,
  Tone3000Model,
  Tone3000Tone,
  ToneSearchParams,
} from "./types.js";

export interface Tone3000ClientOptions {
  baseUrl: string;
  secretKey?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class Tone3000Client {
  private readonly cache: TtlCache<unknown>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: Tone3000ClientOptions) {
    this.cache = new TtlCache(options.cacheTtlMs ?? 300_000);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 12_000;
  }

  get configured(): boolean {
    return Boolean(this.options.secretKey);
  }

  async searchTones(params: ToneSearchParams): Promise<PaginatedResponse<Tone3000Tone>> {
    const query = new URLSearchParams();
    if (params.query) query.set("query", params.query);
    query.set("page", String(params.page ?? 1));
    query.set("page_size", String(Math.min(params.pageSize ?? 10, 25)));
    if (params.sort) query.set("sort", params.sort);
    if (params.gears?.length) query.set("gears", params.gears.join("_"));
    if (params.sizes?.length) query.set("sizes", params.sizes.join("_"));
    if (params.tags?.length) query.set("tags", params.tags.join("_"));
    if (params.makes?.length) query.set("makes", params.makes.join("_"));
    if (params.creators?.length) query.set("creators", params.creators.join(","));
    if (params.format) query.set("format", params.format);
    if (params.architecture) query.set("architecture", params.architecture);
    if (params.calibrated) query.set("calibrated", "true");
    if (params.verified) query.set("verified", "true");

    return this.get<PaginatedResponse<Tone3000Tone>>(`/tones/search?${query.toString()}`);
  }

  async getTone(id: number, architecture?: "1" | "2" | "custom"): Promise<Tone3000Tone> {
    const suffix = architecture ? `?architecture=${encodeURIComponent(architecture)}` : "";
    return this.get<Tone3000Tone>(`/tones/${id}${suffix}`);
  }

  async listModels(
    toneId: number,
    architecture?: "1" | "2" | "custom",
  ): Promise<PaginatedResponse<Tone3000Model>> {
    const query = new URLSearchParams({ tone_id: String(toneId), page: "1", page_size: "300" });
    if (architecture) query.set("architecture", architecture);
    return this.get<PaginatedResponse<Tone3000Model>>(`/models?${query.toString()}`);
  }

  private async get<T>(path: string): Promise<T> {
    const token = this.options.secretKey;
    if (!token) {
      throw new Tone3000Error(
        "TONE3000 is not configured. Set TONE3000_SECRET_KEY on the server.",
        "missing_credentials",
      );
    }

    const url = `${this.options.baseUrl.replace(/\/$/, "")}${path}`;
    const cached = this.cache.get(url);
    if (cached !== undefined) return cached as T;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "is unavailable";
      throw new Tone3000Error(`The TONE3000 API ${reason}. Try again later.`, "unavailable");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Tone3000Error(
        "TONE3000 rejected the credential or this endpoint is unavailable to this integration. Reauthorize or check the API access tier.",
        "unauthorized",
      );
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new Tone3000Error(
        "TONE3000 rate-limited this request. Use the Select OAuth flow for catalog browsing or try again later.",
        "rate_limited",
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    if (!response.ok) {
      throw new Tone3000Error(`TONE3000 returned HTTP ${response.status}. Try again later.`, "unavailable");
    }

    try {
      const value = (await response.json()) as T;
      this.cache.set(url, value);
      return value;
    } catch {
      throw new Tone3000Error("TONE3000 returned an invalid JSON response.", "invalid_response");
    }
  }
}
