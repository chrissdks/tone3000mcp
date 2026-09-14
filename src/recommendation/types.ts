import type { AmplitubeGear } from "../amplitube/types.js";
import type { NormalizedTone } from "../tone3000/types.js";

export type Workflow = "tone3000" | "amplitube" | "hybrid";
export type DeliveryKind = "tone3000-preset" | "amplitube-instructions" | "amplitube-instructions-and-tone3000-ir";

export interface RecommendationInput {
  target: string;
  guitarType?: string;
  pickupType?: string;
  tuning?: string;
  desiredGain?: "clean" | "crunch" | "high-gain";
  preferredWorkflow?: Workflow;
  priority?: "ready-to-play" | "maximum-tweakability" | "cabinet-flexibility";
  ownsAmplitube5Max?: boolean;
  tone3000PluginInstalled?: boolean;
}

export interface KnobSettings {
  input: string;
  gain: number;
  bass: number;
  mid: number;
  treble: number;
  presence: number;
  master?: number;
  odDrive?: number;
  odTone?: number;
  odLevel?: number;
  lowCutHz?: number;
  highCutKhz?: number;
}

export interface ToneApproach {
  workflow: Workflow;
  deliveryKind: DeliveryKind;
  title: string;
  signalChain: string[];
  tone3000Models: NormalizedTone[];
  amplitubeGear: AmplitubeGear[];
  settings: KnobSettings;
  cabRecommendation: string;
  gainStaging: string[];
  rationale: string[];
  warnings: string[];
}

export interface RecommendationResult {
  target: string;
  interpretation: string;
  preferredWorkflow: Workflow | null;
  recommendedWorkflow: Workflow;
  decision: string;
  approaches: ToneApproach[];
  caveats: string[];
  tone3000Status: string;
}

export interface TroubleshootAdjustment {
  priority: number;
  action: string;
  exactChange: string;
  why: string;
}
