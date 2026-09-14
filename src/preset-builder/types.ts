export interface Tone3000PresetBlock {
  tone: number;
  model?: string;
  mix?: number;
  outGain?: number;
  inGain?: number;
  enabled?: boolean;
  slimSize?: number;
}

export interface Tone3000PresetParameters {
  outputLevel?: number;
  inputLevel?: number;
  toneBass?: number;
  toneMid?: number;
  toneTreble?: number;
  toneEqEnabled?: 0 | 1;
  gateEnabled?: 0 | 1;
  gateThreshold?: number;
  chainPanLeft?: number;
  chainPanRight?: number;
  spreadEnabled?: 0 | 1;
  alignEnabled?: 0 | 1;
}

export interface Tone3000PresetRecipe {
  name: string;
  chain: Tone3000PresetBlock[];
  stereo?: {
    branchAfter?: number;
    right: Tone3000PresetBlock[];
  };
  params?: Tone3000PresetParameters;
}

export interface GeneratedPresetFile {
  fileName: string;
  localPath: string;
  downloadUrl: string | null;
}

export interface GeneratedPresetArtifact {
  artifactId: string;
  recipe: Tone3000PresetRecipe;
  files: GeneratedPresetFile[];
  builderCommit: string;
  attribution: string;
}

export type PresetVoicing = "mono" | "stereo";
