import "dotenv/config";
import path from "node:path";

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface AppConfig {
  tone3000: {
    baseUrl: string;
    secretKey?: string;
    cacheTtlMs: number;
    timeoutMs: number;
  };
  port: number;
  profileStorePath: string;
}

export function loadConfig(): AppConfig {
  return {
    tone3000: {
      baseUrl: (process.env.TONE3000_API_BASE_URL ?? "https://www.tone3000.com/api/v1").replace(/\/$/, ""),
      secretKey: process.env.TONE3000_SECRET_KEY?.trim() || undefined,
      cacheTtlMs: positiveNumber(process.env.TONE3000_CACHE_TTL_SECONDS, 300) * 1000,
      timeoutMs: positiveNumber(process.env.TONE3000_TIMEOUT_MS, 12_000),
    },
    port: positiveNumber(process.env.PORT, 8787),
    profileStorePath: path.resolve(process.cwd(), process.env.PROFILE_STORE_PATH ?? ".cache/user-profiles.json"),
  };
}
