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

function gearFor(recipe: TargetRecipe, options: { includeCab?: boolean; includeEffects?: boolean } = {}): AmplitubeGear[] {
  const includeCab = options.includeCab ?? true;
  const includeEffects = options.includeEffects ?? true;
  return compact([
    recipe.gainClass === "high-gain" ? getAmplitubeGear("stomp-noise-gate") : getAmplitubeGear("stomp-compressor"),
    recipe.settings.odLevel ? getAmplitubeGear("stomp-diode-overdrive") : undefined,
    getAmplitubeGear(recipe.ampId),
    includeCab ? getAmplitubeGear(recipe.cabId) : undefined,
    includeEffects ? getAmplitubeGear("rack-parametric-eq") : undefined,
    includeEffects ? getAmplitubeGear("rack-digital-reverb") : undefined,
  ]);
}

function chooseRecommendedWorkflow(input: RecommendationInput, hasLiveTones: boolean): { workflow: Workflow; decision: string } {
  if (input.preferredWorkflow) {
    return { workflow: input.preferredWorkflow, decision: "The user explicitly selected this workflow." };
  }
  if (input.ownsAmplitube5Max === false) {
    return { workflow: "tone3000", decision: "TONE3000 is preferred because AmpliTube 5 MAX is not available in the supplied setup." };
  }
  if (input.priority === "maximum-tweakability") {
    return { workflow: "amplitube", decision: "AmpliTube is preferred because continuously adjustable amp controls are the priority." };
  }
  if (input.priority === "cabinet-flexibility" || /tone3000\s+(cab|ir)|cabinet\s+ir|impulse response/i.test(input.target)) {
    return { workflow: "hybrid", decision: "The hybrid workflow keeps the AmpliTube amp adjustable while using a TONE3000 cabinet IR." };
  }
  if (input.tone3000PluginInstalled === false) {
    return { workflow: "amplitube", decision: "AmpliTube is preferred because the TONE3000 plugin is not installed in the supplied setup." };
  }
  if (hasLiveTones) {
    return { workflow: "tone3000", decision: "A matching live capture is available, so a ready-to-load TONE3000 plugin preset is the fastest testable result." };
  }
  return { workflow: "amplitube", decision: "AmpliTube instructions are the most complete offline deliverable because no live TONE3000 capture was resolved." };
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

async function findCabIrs(client: Tone3000Client, recipe: TargetRecipe): Promise<{ tones: NormalizedTone[]; status: string }> {
  if (!client.configured) {
    return { tones: [], status: "Live TONE3000 cabinet search is disabled until TONE3000_SECRET_KEY is configured." };
  }
  try {
    const query = `${recipe.cabDescription} cabinet IR`;
    const response = await client.searchTones({ query, pageSize: 6, sort: "best-match", gears: ["cab"], format: "ir" });
    const tones = rankTones(response.data.map(normalizeTone), { query, desiredGear: ["cab"] }).slice(0, 4);
    return {
      tones,
      status: tones.length ? `Found ${tones.length} ranked TONE3000 cabinet IR candidates.` : "TONE3000 returned no matching cabinet IRs.",
    };
  } catch (error) {
    const message = error instanceof Tone3000Error ? error.message : "TONE3000 cabinet search failed unexpectedly.";
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
  const selectedWorkflows: Workflow[] = input.preferredWorkflow ? [input.preferredWorkflow] : ["tone3000", "amplitube", "hybrid"];
  const live = selectedWorkflows.includes("tone3000") ? await findTones(client, recipe) : { tones: [], status: "TONE3000 amp search was not needed for this workflow." };
  const cabinetIrs = selectedWorkflows.includes("hybrid") ? await findCabIrs(client, recipe) : { tones: [], status: "TONE3000 cabinet search was not needed for this workflow." };
  const settings = applyInstrumentAdjustments({ input: "Set interface gain so hard picking stays clean and does not clip before the model.", ...recipe.settings }, input);
  const first = live.tones[0];
  const t3kChain = toneChain(first);
  const recommended = chooseRecommendedWorkflow(input, live.tones.length > 0);
  const approaches: ToneApproach[] = [];

  if (selectedWorkflows.includes("tone3000")) {
    approaches.push({
      workflow: "tone3000",
      deliveryKind: "tone3000-preset",
      title: "Ready-to-load TONE3000 plugin preset",
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
      deliveryKind: "amplitube-instructions",
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
    const cabinetIr = cabinetIrs.tones[0];
    const amplitubeGear = gearFor(recipe, { includeCab: false });
    approaches.push({
      workflow: "hybrid",
      deliveryKind: "amplitube-instructions-and-tone3000-ir",
      title: "Adjustable AmpliTube amp with a TONE3000 cabinet IR",
      signalChain: [
        ...amplitubeGear.filter((item) => item.type === "stomp").map((item) => `AmpliTube ${item.displayName}`),
        `AmpliTube ${getAmplitubeGear(recipe.ampId)?.displayName ?? "amp"}`,
        cabinetIr ? `AmpliTube IR Loader: TONE3000 cabinet IR ${cabinetIr.title}` : "AmpliTube IR Loader: select a compatible TONE3000 cabinet IR",
        "AmpliTube post-EQ and ambience",
      ],
      tone3000Models: cabinetIrs.tones,
      amplitubeGear,
      settings,
      cabRecommendation: cabinetIr ? `Download ${cabinetIr.title} from ${cabinetIr.directUrl} and load its .wav model into AmpliTube's IR Loader.` : recipe.cabDescription,
      gainStaging: [settings.input, "Disable AmpliTube's normal cabinet block when the external TONE3000 IR is active.", "Level-match the IR Loader before judging cabinet differences."],
      rationale: [recipe.interpretation, "This keeps the amp continuously adjustable in AmpliTube while using a specific TONE3000 cabinet capture."],
      warnings: cabinetIr ? ["Use an IR-format .wav model. Do not load a NAM amp capture into AmpliTube's IR Loader."] : ["No live cabinet IR was resolved; search TONE3000 cabinets before building this chain."],
    });
  }

  return {
    target: input.target,
    interpretation: recipe.interpretation,
    preferredWorkflow: input.preferredWorkflow ?? null,
    recommendedWorkflow: recommended.workflow,
    decision: recommended.decision,
    approaches,
    caveats: [
      "All values are starting points on a 0–10 scale, not claims of exact recorded settings.",
      "Pickup output, guitar, tuning, interface gain, monitoring volume, and IR choice can change the result substantially.",
      "Artist references describe an approximation or useful starting point unless a capture's creator supplies stronger evidence.",
    ],
    tone3000Status: [live.status, cabinetIrs.status].filter((status) => !status.includes("was not needed")).join(" "),
  };
}
