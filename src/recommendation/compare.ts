import type { NormalizedTone } from "../tone3000/types.js";

export interface ToneComparisonRow {
  id: number;
  title: string;
  directUrl: string;
  gainStructure: string;
  eqCharacter: string;
  cabRequirement: string;
  flexibility: string;
  likelyUse: string;
}

function inferGain(tone: NormalizedTone): string {
  const text = `${tone.title} ${tone.description ?? ""} ${tone.tags.join(" ")}`.toLowerCase();
  if (/high.?gain|metal|lead|distort|5150|6505|rect/.test(text)) return "Likely high gain; confirm from the creator description and audition level-matched.";
  if (/clean|pristine/.test(text)) return "Likely clean or low gain.";
  if (/crunch|edge|breakup|drive/.test(text)) return "Likely crunch or medium gain.";
  return "Gain level is not established by the available metadata.";
}

function inferEq(tone: NormalizedTone): string {
  const text = `${tone.description ?? ""} ${tone.tags.join(" ")}`.toLowerCase();
  const traits = ["bright", "dark", "tight", "warm", "scooped", "mid-forward", "vintage", "modern"].filter((term) => text.includes(term));
  return traits.length ? traits.join(", ") : "Not established by metadata; audition through the same cab/IR and at matched loudness.";
}

export function compareNormalizedTones(tones: NormalizedTone[]): { rows: ToneComparisonRow[]; guidance: string[] } {
  return {
    rows: tones.map((tone) => ({
      id: tone.id,
      title: tone.title,
      directUrl: tone.directUrl,
      gainStructure: inferGain(tone),
      eqCharacter: inferEq(tone),
      cabRequirement: tone.requiresCabOrIr ? "Needs a downstream cab or IR." : tone.alreadyContainsCabinet ? "Cabinet coloration is already included; avoid a second cab by default." : "Confirm the captured stages from the creator notes.",
      flexibility: tone.captureType === "amp-head" ? "Best cab/mic flexibility, but the captured amp settings remain a fixed snapshot." : tone.captureType === "amp-and-cab" ? "Fastest to use, with less freedom to change the captured cab/mic character." : "Depends on where this capture is placed in the chain.",
      likelyUse: tone.captureType === "amp-head" ? "Hybrid rigs and users who want to choose IRs." : tone.captureType === "amp-and-cab" ? "Quick recall and simple TONE3000-focused rigs." : tone.captureType === "cabinet-ir" ? "Pairing after an amp-head capture or full amp simulation." : "Specialized placement according to capture type.",
    })),
    guidance: [
      "Compare all candidates through the same downstream stages and at matched loudness.",
      "A NAM capture is a fixed snapshot; AmpliTube amp models remain continuously adjustable.",
      "Metadata-based tonal descriptions are hypotheses until auditioned with your guitar and monitoring chain.",
    ],
  };
}
