import "dotenv/config";
import path from "node:path";
import type { PresetBuilderConfig } from "./preset-builder/client.js";

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
  presetBuilder: Omit<PresetBuilderConfig, "downloadBaseUrl" | "tone3000SecretKey">;
  host: string;
  port: number;
  profileStorePath: string;
}

export function loadConfig(): AppConfig {
  const tone3000SecretKey = process.env.TONE3000_SECRET_KEY?.trim() || undefined;
  return {
    tone3000: {
      baseUrl: (process.env.TONE3000_API_BASE_URL ?? "https://www.tone3000.com/api/v1").replace(/\/$/, ""),
      secretKey: tone3000SecretKey,
      cacheTtlMs: positiveNumber(process.env.TONE3000_CACHE_TTL_SECONDS, 300) * 1000,
      timeoutMs: positiveNumber(process.env.TONE3000_TIMEOUT_MS, 12_000),
    },
    presetBuilder: {
      rootPath: path.resolve(process.cwd(), process.env.TONE3000_PRESET_BUILDER_PATH ?? "vendor/tone3000-preset-builder"),
      outputPath: path.resolve(process.cwd(), process.env.PRESET_OUTPUT_PATH ?? ".cache/generated-presets"),
      pythonCommand: process.env.PYTHON_COMMAND?.trim() || "python",
      timeoutMs: positiveNumber(process.env.PRESET_BUILDER_TIMEOUT_MS, 120_000),
      commit: process.env.PRESET_BUILDER_COMMIT?.trim() || undefined,
    },
    host: process.env.HOST?.trim() || "127.0.0.1",
    port: positiveNumber(process.env.PORT, 8787),
    profileStorePath: path.resolve(process.cwd(), process.env.PROFILE_STORE_PATH ?? ".cache/user-profiles.json"),
  };
}
