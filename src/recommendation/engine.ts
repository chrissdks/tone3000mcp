import { getAmplitubeGear } from "../amplitube/search.js";
import type { AmplitubeGear } from "../amplitube/types.js";
import { Tone3000Client } from "../tone3000/client.js";
import { Tone3000Error } from "../tone3000/errors.js";
import { normalizeTone, rankTones } from "../tone3000/normalize.js";
import type { NormalizedTone, Tone3000Gear } from "../tone3000/types.js";
import type {
  KnobSettings,
  RecommendationInput,
  RecommendationResult,
  ToneApproach,
  Workflow,
} from "./types.js";

interface TargetRecipe {
  interpretation: string;
  query: string;
  gainClass: "clean" | "crunch" | "high-gain";
  ampId: string;
  cabId: string;
  settings: Omit<KnobSettings, "input">;
  cabDescription: string;
}

function recipeFor(target: string, desiredGain?: RecommendationInput["desiredGain"]): TargetRecipe {
  const value = target.toLowerCase();
  if (value.includes("metallica") || value.includes("black album")) {
    return {
      interpretation: "Tight early-1990s metal rhythm: percussive lows, controlled gain, and an aggressive but not scooped-away midrange.",
      query: "Metallica Black Album Mesa Mark tight rhythm",
      gainClass: "high-gain",
      ampId: "amp-metal-lead-t",
      cabId: "cab-4x12-metal-t",
      settings: { gain: 4.5, bass: 4, mid: 4.5, treble: 6, presence: 5, master: 6, odDrive: 0.5, odTone: 5, odLevel: 8, lowCutHz: 80, highCutKhz: 9 },
      cabDescription: "Closed-back 4x12 with a modern, focused speaker; start with a 57-style mic slightly off the dust-cap edge.",
    };
  }
  if (value.includes("cantrell") || value.includes("alice in chains") || value.includes("dirt")) {
    return {
      interpretation: "Dirt-era-inspired heavy rock rhythm: chewy mids, layered British/hot-rodded gain, and less clinical low-end tightening.",
      query: "Jerry Cantrell Dirt Bogner Marshall rhythm",
      gainClass: "high-gain",
      ampId: "amp-sld-100",
      cabId: "cab-4x12-brit-8000",
      settings: { gain: 5.5, bass: 4.5, mid: 6, treble: 5.5, presence: 4.5, master: 6, odDrive: 1.5, odTone: 4.5, odLevel: 6.5, lowCutHz: 75, highCutKhz: 8.5 },
      cabDescription: "British 4x12; favor a warmer speaker/mic position to retain the vocal midrange and avoid fizz.",
    };
  }
  if (value.includes("5150") || value.includes("6505") || value.includes("modern metal")) {
    return {
      interpretation: "Modern 5150-family metal: fast attack, controlled low end, moderate preamp gain, and a low-drive boost.",
      query: "5150 6505 amp high gain tight modern metal",
      gainClass: "high-gain",
      ampId: "amp-sj50",
      cabId: "cab-4x12-metal-v",
      settings: { gain: 4.5, bass: 4, mid: 5, treble: 5.5, presence: 4.5, master: 5.5, odDrive: 0.5, odTone: 5, odLevel: 8, lowCutHz: 75, highCutKhz: 9 },
      cabDescription: "Tight closed-back 4x12, preferably a 5150/V30-family option; move the close mic outward if the top is scratchy.",
    };
  }
  if (value.includes("fender") || value.includes("clean")) {
    return {
      interpretation: "American-style clean: wide headroom, clear pick attack, an open cabinet, and restrained compression.",
      query: "Fender clean Twin Deluxe amp",
      gainClass: "clean",
      ampId: "amp-american-tube-clean",
      cabId: "cab-1x12-open-vintage",
      settings: { gain: 3, bass: 4.5, mid: 5, treble: 5.5, presence: 4, master: 7, lowCutHz: 70, highCutKhz: 11 },
      cabDescription: "Open-back 1x12 or 2x12 with an American-style speaker; blend a small amount of room for depth.",
    };
  }
  const gainClass = desiredGain ?? "crunch";
  return {
    interpretation: `${gainClass === "clean" ? "Clean" : gainClass === "high-gain" ? "High-gain" : "Crunch"} guitar tone shaped around the supplied style keywords.`,
    query: target,
    gainClass,
    ampId: gainClass === "clean" ? "amp-american-tube-clean" : gainClass === "high-gain" ? "amp-sld-100" : "amp-brit-8000",
    cabId: gainClass === "clean" ? "cab-1x12-open-vintage" : "cab-4x12-closed-modern",
    settings: { gain: gainClass === "clean" ? 3 : gainClass === "high-gain" ? 5 : 4.5, bass: 4.5, mid: 5.5, treble: 5.5, presence: 4.5, master: 6, odDrive: gainClass === "clean" ? undefined : 0.5, odTone: 5, odLevel: gainClass === "clean" ? undefined : 7.5, lowCutHz: 75, highCutKhz: gainClass === "clean" ? 11 : 9 },
    cabDescription: gainClass === "clean" ? "Open-back vintage cabinet with an American-style speaker." : "Closed-back 4x12 chosen to balance upper-mid focus and low-end control.",
  };
}

function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}

function gearFor(recipe: TargetRecipe, includeEffects = true): AmplitubeGear[] {
  return compact([
    recipe.gainClass === "high-gain" ? getAmplitubeGear("stomp-noise-gate") : getAmplitubeGear("stomp-compressor"),
    recipe.settings.odLevel ? getAmplitubeGear("stomp-diode-overdrive") : undefined,
    getAmplitubeGear(recipe.ampId),
    getAmplitubeGear(recipe.cabId),
    includeEffects ? getAmplitubeGear("rack-parametric-eq") : undefined,
    includeEffects ? getAmplitubeGear("rack-digital-reverb") : undefined,
  ]);
}

function applyInstrumentAdjustments(settings: KnobSettings, input: RecommendationInput): KnobSettings {
  const output = { ...settings };
  const pickups = (input.pickupType ?? "").toLowerCase();
  const guitar = (input.guitarType ?? "").toLowerCase();
  if (pickups.includes("humbucker") || guitar.includes("les paul")) {
    output.gain = Math.max(0, output.gain - 0.5);
    output.bass = Math.max(0, output.bass - 0.5);
  } else if (pickups.includes("single")) {
    output.gain = Math.min(10, output.gain + 0.5);
  }
  if (/drop|baritone|7|string|8|string/.test((input.tuning ?? "").toLowerCase())) {
    output.bass = Math.max(0, output.bass - 0.5);
    output.lowCutHz = Math.max(70, (output.lowCutHz ?? 70) - 5);
  }
  return output;
}

async function findTones(client: Tone3000Client, recipe: TargetRecipe): Promise<{ tones: NormalizedTone[]; status: string }> {
  if (!client.configured) {
    return { tones: [], status: "Live TONE3000 search is disabled until TONE3000_SECRET_KEY is configured." };
  }
  try {
    const response = await client.searchTones({
      query: recipe.query,
      pageSize: 8,
      sort: "best-match",
      gears: ["amp", "amp-cab"],
      format: "nam",
    });
    const tones = rankTones(response.data.map(normalizeTone), {
      query: recipe.query,
      desiredGear: ["amp", "amp-cab"],
      workflow: "hybrid",
    }).slice(0, 4);
    return {
      tones,
      status: tones.length ? `Found ${tones.length} ranked TONE3000 candidates.` : "TONE3000 returned no matching captures; broaden the query or use its Select OAuth flow.",
    };
  } catch (error) {
    const message = error instanceof Tone3000Error ? error.message : "TONE3000 search failed unexpectedly.";
    return { tones: [], status: message };
  }
}

function toneChain(tone: NormalizedTone | undefined): { chain: string[]; warnings: string[] } {
  if (!tone) return { chain: ["Input", "Noise Gate (if needed)", "TONE3000 capture", "Cab/IR when required", "Post EQ"], warnings: [] };
  if (tone.requiresCabOrIr) {
    return { chain: ["Input", "Noise Gate", "Low-drive boost (optional)", `TONE3000 amp-head: ${tone.title}`, "Cab/IR", "Post EQ"], warnings: [] };
  }
  if (tone.alreadyContainsCabinet) {
    return { chain: ["Input", "Noise Gate", `TONE3000 ${tone.captureType}: ${tone.title}`, "Post EQ", "Delay/Reverb"], warnings: [tone.cabWarning! ] };
  }
  return { chain: ["Input", `TONE3000 ${tone.captureType}: ${tone.title}`, "Amp/cab stages as appropriate", "Post effects"], warnings: ["Confirm what hardware stages were included before adding another amp or cabinet."] };
}

export async function recommendToneChain(client: Tone3000Client, input: RecommendationInput): Promise<RecommendationResult> {
  const recipe = recipeFor(input.target, input.desiredGain);
  const live = await findTones(client, recipe);
  const settings = applyInstrumentAdjustments({ input: "Set interface gain so hard picking stays clean and does not clip before the model.", ...recipe.settings }, input);
  const first = live.tones[0];
  const t3kChain = toneChain(first);
  const selectedWorkflows: Workflow[] = input.preferredWorkflow ? [input.preferredWorkflow] : ["tone3000", "amplitube", "hybrid"];
  const approaches: ToneApproach[] = [];

  if (selectedWorkflows.includes("tone3000")) {
    approaches.push({
      workflow: "tone3000",
      title: "TONE3000-focused",
      signalChain: t3kChain.chain,
      tone3000Models: live.tones,
      amplitubeGear: [],
      settings,
      cabRecommendation: first?.requiresCabOrIr ? recipe.cabDescription : first?.alreadyContainsCabinet ? "The chosen capture includes cabinet coloration; do not add a second cab by default." : recipe.cabDescription,
      gainStaging: [settings.input, "Match bypassed and processed loudness before judging EQ.", "A NAM capture is a fixed snapshot; use small pre/post changes rather than treating it like a continuously adjustable amp."],
      rationale: [recipe.interpretation, "Candidates are ranked for query match, capture type, metadata, and community indicators when available."],
      warnings: t3kChain.warnings,
    });
  }

  if (selectedWorkflows.includes("amplitube")) {
    const selectedGear = gearFor(recipe);
    approaches.push({
      workflow: "amplitube",
      title: "AmpliTube 5 MAX-only",
      signalChain: selectedGear.map((item) => item.displayName),
      tone3000Models: [],
      amplitubeGear: selectedGear,
      settings,
      cabRecommendation: recipe.cabDescription,
      gainStaging: [settings.input, "Raise the amp master/output for level before adding more preamp gain.", "Keep post-EQ boosts small and level-match comparisons."],
      rationale: [recipe.interpretation, "This approach preserves continuous amp control and makes cabinet, microphones, room, and post effects easy to refine."],
      warnings: [],
    });
  }

  if (selectedWorkflows.includes("hybrid")) {
    const hybridTone = live.tones.find((tone) => tone.captureType === "amp-head") ?? first;
    const hybridChain = toneChain(hybridTone);
    const postGear = compact([getAmplitubeGear("stomp-noise-gate"), recipe.settings.odLevel ? getAmplitubeGear("stomp-diode-overdrive") : undefined, hybridTone?.requiresCabOrIr ? getAmplitubeGear(recipe.cabId) : undefined, getAmplitubeGear("rack-parametric-eq"), getAmplitubeGear("rack-digital-reverb")]);
    approaches.push({
      workflow: "hybrid",
      title: "Hybrid",
      signalChain: hybridTone?.requiresCabOrIr
        ? ["AmpliTube Noise Gate", "AmpliTube low-drive boost", `TONE3000 amp-head: ${hybridTone.title}`, `AmpliTube cab: ${getAmplitubeGear(recipe.cabId)?.displayName ?? "matching cab"}`, "AmpliTube Parametric EQ", "AmpliTube Digital Reverb"]
        : hybridChain.chain,
      tone3000Models: hybridTone ? [hybridTone] : [],
      amplitubeGear: postGear,
      settings,
      cabRecommendation: hybridTone?.alreadyContainsCabinet ? "Skip AmpliTube's cab block because this capture already contains a cabinet." : recipe.cabDescription,
      gainStaging: [settings.input, "Keep the boost output below digital clipping.", "Level-match the TONE3000 block before and after AmpliTube post processing."],
      rationale: [recipe.interpretation, "The capture supplies the fixed amp snapshot while AmpliTube supplies flexible boost, cabinet/mic choice, EQ, delay, and reverb."],
      warnings: hybridChain.warnings,
    });
  }

  return {
    target: input.target,
    interpretation: recipe.interpretation,
    preferredWorkflow: input.preferredWorkflow ?? null,
    approaches,
    caveats: [
      "All values are starting points on a 0–10 scale, not claims of exact recorded settings.",
      "Pickup output, guitar, tuning, interface gain, monitoring volume, and IR choice can change the result substantially.",
      "Artist references describe an approximation or useful starting point unless a capture's creator supplies stronger evidence.",
    ],
    tone3000Status: live.status,
  };
}
