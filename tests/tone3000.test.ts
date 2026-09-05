import { describe, expect, it, vi } from "vitest";
import { Tone3000Client } from "../src/tone3000/client.js";
import { classifyCapture, normalizeTone, parseToneId, rankTones } from "../src/tone3000/normalize.js";
import type { Tone3000Tone, ToneSearchParams } from "../src/tone3000/types.js";

function tone(overrides: Partial<Tone3000Tone> = {}): Tone3000Tone {
  return {
    id: 42,
    title: "Test amp",
    gear: "amp",
    format: "nam",
    url: "https://www.tone3000.com/tones/42",
    tags: [],
    makes: [],
    ...overrides,
  };
}

describe("TONE3000 normalization", () => {
  it("classifies cab requirements without double-cab ambiguity", () => {
    expect(classifyCapture(tone({ gear: "amp" }))).toBe("amp-head");
    expect(classifyCapture(tone({ gear: "amp-cab" }))).toBe("amp-and-cab");
    expect(classifyCapture(tone({ gear: "cab", format: "ir" }))).toBe("cabinet-ir");
    expect(normalizeTone(tone({ gear: "amp" })).requiresCabOrIr).toBe(true);
    expect(normalizeTone(tone({ gear: "amp-cab" })).cabWarning).toContain("already includes");
  });

  it("parses numeric IDs and official URLs, and rejects other domains", () => {
    expect(parseToneId(123)).toBe(123);
    expect(parseToneId("https://www.tone3000.com/tones/456" )).toBe(456);
    expect(parseToneId("https://tone3000.com/foo?tone_id=789")).toBe(789);
    expect(() => parseToneId("https://example.com/tones/456")).toThrow(/tone3000/);
  });

  it("ranks capture type, text relevance, and community metadata", () => {
    const ranked = rankTones([
      normalizeTone(tone({ id: 1, title: "Generic", downloads_count: 2, url: "https://www.tone3000.com/tones/1" })),
      normalizeTone(tone({ id: 2, title: "5150 tight modern metal", downloads_count: 1000, url: "https://www.tone3000.com/tones/2" })),
    ], { query: "tight 5150 metal", desiredGear: ["amp"], workflow: "hybrid" });
    expect(ranked[0].id).toBe(2);
  });
});

describe("TONE3000 client", () => {
  it("uses documented search parameters and caches identical metadata reads", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ data: [], page: 1, page_size: 10, total: 0, total_pages: 0 }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const client = new Tone3000Client({ baseUrl: "https://www.tone3000.com/api/v1", secretKey: "test-secret", fetchImpl: fetchImpl as typeof fetch });
    const params: ToneSearchParams = { query: "5150", gears: ["amp", "amp-cab"], tags: ["high-gain"], makes: ["Peavey 5150"], pageSize: 10 };
    await client.searchTones(params);
    await client.searchTones(params);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = requestedUrls[0];
    expect(url).toContain("/tones/search?");
    expect(url).toContain("gears=amp_amp-cab");
    expect(url).toContain("tags=high-gain");
    expect(url).toContain("makes=Peavey+5150");
  });

  it("turns 429 responses into a safe rate-limit error", async () => {
    const client = new Tone3000Client({ baseUrl: "https://www.tone3000.com/api/v1", secretKey: "test-secret", fetchImpl: vi.fn(async () => new Response("", { status: 429, headers: { "retry-after": "30" } })) as unknown as typeof fetch });
    await expect(client.searchTones({ query: "metal" })).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 30 });
  });
});
