export type AmplitubeGearType = "amp" | "cabinet" | "speaker" | "microphone" | "stomp" | "rack" | "room";
export type GainClass = "clean" | "crunch" | "high-gain" | "utility";
export type MappingConfidence = "official" | "inferred" | "not-stated" | "original" | "unresolved" | "not-applicable";

export interface AmplitubeGear {
  id: string;
  displayName: string;
  type: AmplitubeGearType;
  collection?: string;
  includedIn: string[];
  inventoryVersion: string;
  inventoryPage: number;
  inventorySourceUrl: string;
  gainClass?: GainClass;
  hardwareEquivalent?: string;
  modeledFamily?: string;
  mappingConfidence: MappingConfidence;
  aliases: string[];
  tonalCharacter: string[];
  controls: string[];
  styles: string[];
  pairings: string[];
  cabinetSize?: string;
  speakerFamily?: string;
  role?: string;
  notes?: string;
  manualPage?: number;
  sourceUrl: string;
}

export interface AmplitubeCatalog {
  schemaVersion: number;
  product: string;
  inventoryVersion: string;
  inventoryUpdated: string;
  inventorySourceUrl: string;
  categoryCounts: Record<AmplitubeGearType, number>;
  total: number;
  gear: AmplitubeGear[];
}
