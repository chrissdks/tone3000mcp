import gearData from "../data/amplitube5max.json" with { type: "json" };
import type { AmplitubeGear, AmplitubeGearType, GainClass } from "./types.js";

const gear = gearData as AmplitubeGear[];

export interface GearSearch {
  gearType?: AmplitubeGearType;
  ampFamily?: string;
  gainClass?: GainClass;
  keywords?: string[];
  limit?: number;
}

export function allAmplitubeGear(): AmplitubeGear[] {
  return [...gear];
}

export function getAmplitubeGear(id: string): AmplitubeGear | undefined {
  return gear.find((item) => item.id === id);
}

export function searchAmplitubeGear(input: GearSearch): AmplitubeGear[] {
  const familyTokens = (input.ampFamily ?? "").toLowerCase().split(/\W+/).filter(Boolean);
  const tokens = [...familyTokens, ...(input.keywords ?? []).flatMap((word) => word.toLowerCase().split(/\W+/))]
    .filter((token) => token.length > 1);

  return gear
    .filter((item) => !input.gearType || item.type === input.gearType)
    .filter((item) => !input.gainClass || item.gainClass === input.gainClass)
    .map((item, index) => {
      const haystack = [
        item.displayName,
        item.modeledFamily ?? "",
        ...item.tonalCharacter,
        ...item.styles,
        item.role ?? "",
      ].join(" ").toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 4 : 0), 0)
        + (familyTokens.some((token) => (item.modeledFamily ?? "").toLowerCase().includes(token)) ? 6 : 0);
      return { item, score, index };
    })
    .filter(({ score }) => tokens.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(input.limit ?? 10, 25))
    .map(({ item }) => item);
}
