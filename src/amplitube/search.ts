import gearData from "../data/amplitube5max.json" with { type: "json" };
import type { AmplitubeCatalog, AmplitubeGear, AmplitubeGearType, GainClass } from "./types.js";

const catalog = gearData as AmplitubeCatalog;
const gear = catalog.gear;

export interface GearSearch {
  gearType?: AmplitubeGearType;
  ampFamily?: string;
  gainClass?: GainClass;
  keywords?: string[];
  offset?: number;
  limit?: number;
}

export interface GearSearchPage {
  results: AmplitubeGear[];
  totalMatches: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export function allAmplitubeGear(): AmplitubeGear[] {
  return [...gear];
}

export function amplitubeCatalogMetadata(): Omit<AmplitubeCatalog, "gear"> {
  const { gear: _gear, ...metadata } = catalog;
  return { ...metadata, categoryCounts: { ...metadata.categoryCounts } };
}

export function getAmplitubeGear(id: string): AmplitubeGear | undefined {
  return gear.find((item) => item.id === id);
}

export function searchAmplitubeGearPage(input: GearSearch): GearSearchPage {
  const familyTokens = (input.ampFamily ?? "").toLowerCase().split(/\W+/).filter(Boolean);
  const tokens = [...familyTokens, ...(input.keywords ?? []).flatMap((word) => word.toLowerCase().split(/\W+/))]
    .filter((token) => token.length > 1);
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(Math.max(1, Math.trunc(input.limit ?? 25)), 50);

  const matches = gear
    .filter((item) => !input.gearType || item.type === input.gearType)
    .filter((item) => !input.gainClass || item.gainClass === input.gainClass)
    .map((item, index) => {
      const haystack = [
        item.displayName,
        ...(item.aliases ?? []),
        item.hardwareEquivalent ?? "",
        item.modeledFamily ?? "",
        item.collection ?? "",
        ...item.tonalCharacter,
        ...item.styles,
        item.role ?? "",
      ].join(" ").toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 4 : 0), 0)
        + (familyTokens.some((token) => `${item.hardwareEquivalent ?? ""} ${item.modeledFamily ?? ""}`.toLowerCase().includes(token)) ? 6 : 0)
        + (input.keywords?.some((term) => item.displayName.toLowerCase() === term.toLowerCase()) ? 12 : 0);
      return { item, score, index };
    })
    .filter(({ score }) => tokens.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return {
    results: matches.slice(offset, offset + limit).map(({ item }) => item),
    totalMatches: matches.length,
    offset,
    limit,
    hasMore: offset + limit < matches.length,
  };
}

export function searchAmplitubeGear(input: GearSearch): AmplitubeGear[] {
  return searchAmplitubeGearPage(input).results;
}
