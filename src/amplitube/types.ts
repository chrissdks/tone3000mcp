export type AmplitubeGearType = "amp" | "cabinet" | "speaker" | "stomp" | "rack" | "room";
export type GainClass = "clean" | "crunch" | "high-gain" | "utility";

export interface AmplitubeGear {
  id: string;
  displayName: string;
  type: AmplitubeGearType;
  collection: string;
  gainClass?: GainClass;
  modeledFamily?: string;
  mappingConfidence: "official" | "inferred" | "not-stated";
  tonalCharacter: string[];
  controls: string[];
  styles: string[];
  pairings: string[];
  cabinetSize?: string;
  speakerFamily?: string;
  role?: string;
  notes?: string;
  sourceUrl: string;
}
