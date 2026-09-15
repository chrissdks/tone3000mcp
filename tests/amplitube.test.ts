import { describe, expect, it } from "vitest";
import { allAmplitubeGear, amplitubeCatalogMetadata, getAmplitubeGear, searchAmplitubeGear, searchAmplitubeGearPage } from "../src/amplitube/search.js";

describe("AmpliTube 5 MAX v2 catalog", () => {
  it("contains the complete official 5.10.4 inventory", () => {
    const metadata = amplitubeCatalogMetadata();
    const gear = allAmplitubeGear();
    expect(metadata).toMatchObject({ product: "AmpliTube 5 MAX v2", inventoryVersion: "5.10.4", total: 435 });
    expect(metadata.categoryCounts).toEqual({
      stomp: 111,
      amp: 111,
      cabinet: 106,
      speaker: 33,
      microphone: 18,
      rack: 48,
      room: 8,
    });
    expect(gear).toHaveLength(435);
    expect(new Set(gear.map((item) => item.id)).size).toBe(435);
    expect(gear.every((item) => item.inventoryVersion === "5.10.4" && item.inventorySourceUrl.startsWith("https://www.ikmultimedia.com/"))).toBe(true);
  });

  it("keeps every curated recommendation target in the full catalog", () => {
    const requiredIds = [
      "amp-brit-8000", "amp-american-tube-clean", "amp-sld-100", "amp-metal-lead-v", "amp-sj50", "amp-metal-lead-t",
      "cab-4x12-brit-8000", "cab-4x12-metal-v", "cab-4x12-metal-t", "cab-4x12-closed-modern", "cab-1x12-open-vintage",
      "speaker-brit-green", "speaker-american-12k", "stomp-noise-gate", "stomp-diode-overdrive", "stomp-compressor",
      "rack-parametric-eq", "rack-digital-delay", "rack-digital-reverb",
    ];
    expect(requiredIds.every((id) => getAmplitubeGear(id))).toBe(true);
  });

  it.each([
    ["stomp", "X-DRIVE"],
    ["amp", "Mark V"],
    ["speaker", "American J40"],
    ["microphone", "Dynamic 57"],
  ] as const)("searches the complete %s inventory", (gearType, name) => {
    const results = searchAmplitubeGear({ gearType, keywords: [name], limit: 5 });
    expect(results.some((item) => item.displayName === name)).toBe(true);
  });

  it("paginates through every official inventory record", () => {
    const first = searchAmplitubeGearPage({ offset: 0, limit: 50 });
    const last = searchAmplitubeGearPage({ offset: 400, limit: 50 });
    expect(first).toMatchObject({ totalMatches: 435, offset: 0, limit: 50, hasMore: true });
    expect(first.results).toHaveLength(50);
    expect(last).toMatchObject({ totalMatches: 435, offset: 400, limit: 50, hasMore: false });
    expect(last.results).toHaveLength(35);
  });
});
