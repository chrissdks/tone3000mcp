import type { CaptureType, NormalizedTone, Tone3000Tone } from "./types.js";

function names(values: Tone3000Tone["tags"] | Tone3000Tone["makes"]): string[] {
  return (values ?? []).map((value) => (typeof value === "string" ? value : value.name)).filter(Boolean);
}

export function classifyCapture(tone: Pick<Tone3000Tone, "gear" | "format">): CaptureType {
  if (tone.format === "ir") return "cabinet-ir";
  switch (tone.gear) {
    case "amp":
      return "amp-head";
    case "amp-cab":
      return "amp-and-cab";
    case "pedal":
      return "pedal";
    case "cab":
      return "cabinet-capture";
    case "outboard":
      return "outboard";
    case "space":
      return "space";
    case "experimental":
      return "experimental";
    default:
      return "other";
  }
}

export function normalizeTone(tone: Tone3000Tone): NormalizedTone {
  const captureType = classifyCapture(tone);
  const requiresCabOrIr = captureType === "amp-head";
  const alreadyContainsCabinet = captureType === "amp-and-cab" || captureType === "cabinet-ir" || captureType === "cabinet-capture";

  return {
    id: tone.id,
    title: tone.title,
    author: tone.user?.username ?? tone.user?.display_name ?? null,
    verifiedAuthor: tone.user?.is_verified ?? false,
    captureType,
    gear: tone.gear,
    format: tone.format,
    description: tone.description ?? null,
    directUrl: tone.url,
    imageUrl: tone.images?.[0] ?? null,
    makes: names(tone.makes),
    tags: names(tone.tags),
    modelCount: tone.models_count ?? 0,
    downloads: tone.downloads_count ?? 0,
    favorites: tone.favorites_count ?? 0,
    requiresCabOrIr,
    alreadyContainsCabinet,
    cabWarning: alreadyContainsCabinet
      ? "This capture already includes cabinet coloration. Disable any downstream cab/IR unless intentional."
      : null,
  };
}

export function parseToneId(idOrUrl: string | number): number {
  if (typeof idOrUrl === "number" && Number.isInteger(idOrUrl) && idOrUrl > 0) return idOrUrl;
  const value = String(idOrUrl).trim();
  if (/^\d+$/.test(value)) return Number(value);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Provide a numeric TONE3000 tone ID or a valid TONE3000 URL.");
  }
  if (!/(^|\.)tone3000\.com$/i.test(parsed.hostname)) {
    throw new Error("The URL must use the tone3000.com domain.");
  }
  const matches = [...parsed.pathname.matchAll(/\/(?:tone|tones)\/(\d+)(?:\/|$)/gi)];
  const queryId = parsed.searchParams.get("tone_id") ?? parsed.searchParams.get("id");
  const id = matches.at(-1)?.[1] ?? (queryId && /^\d+$/.test(queryId) ? queryId : undefined);
  if (!id) throw new Error("Could not find a numeric tone ID in that TONE3000 URL.");
  return Number(id);
}

export interface RankContext {
  query?: string;
  desiredGear?: string[];
  tags?: string[];
  workflow?: "tone3000" | "amplitube" | "hybrid";
}

export function rankTones(tones: NormalizedTone[], context: RankContext): NormalizedTone[] {
  const queryTokens = (context.query ?? "").toLowerCase().split(/\W+/).filter((token) => token.length > 2);
  const desiredTags = (context.tags ?? []).map((tag) => tag.toLowerCase());
  const desiredGears = new Set(context.desiredGear ?? []);

  const score = (tone: NormalizedTone): number => {
    const haystack = [tone.title, tone.description ?? "", ...tone.tags, ...tone.makes].join(" ").toLowerCase();
    let value = queryTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 8 : 0), 0);
    value += desiredTags.reduce((sum, tag) => sum + (tone.tags.some((item) => item.toLowerCase() === tag) ? 6 : 0), 0);
    value += desiredGears.has(tone.gear) ? 10 : 0;
    value += tone.verifiedAuthor ? 2 : 0;
    value += Math.log10(1 + tone.downloads) + Math.log10(1 + tone.favorites);
    if (context.workflow === "hybrid" && tone.captureType === "amp-head") value += 4;
    return value;
  };

  return tones
    .map((tone, index) => ({ tone, index, score: score(tone) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ tone }) => tone);
}
