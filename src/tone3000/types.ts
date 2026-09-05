export const TONE3000_GEARS = [
  "amp",
  "amp-cab",
  "pedal",
  "outboard",
  "cab",
  "space",
  "experimental",
] as const;

export const TONE3000_FORMATS = ["nam", "ir", "aida-x", "aa-snapshot", "proteus"] as const;
export const TONE3000_ARCHITECTURES = ["1", "2", "custom"] as const;
export const TONE3000_SORTS = ["best-match", "newest", "oldest", "trending", "downloads-all-time"] as const;

export type Tone3000Gear = (typeof TONE3000_GEARS)[number];
export type Tone3000Format = (typeof TONE3000_FORMATS)[number];
export type Tone3000Architecture = (typeof TONE3000_ARCHITECTURES)[number];
export type Tone3000Sort = (typeof TONE3000_SORTS)[number];

export interface EmbeddedUser {
  id?: number;
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
}

export interface TaxonomyValue {
  id?: number;
  name: string;
}

export interface Tone3000Tone {
  id: number;
  user?: EmbeddedUser;
  title: string;
  description?: string | null;
  gear: Tone3000Gear | string;
  format: Tone3000Format | string;
  images?: string[] | null;
  links?: string[] | null;
  makes?: TaxonomyValue[];
  tags?: TaxonomyValue[];
  sizes?: string[];
  models_count?: number;
  a1_models_count?: number;
  a2_models_count?: number;
  custom_models_count?: number;
  irs_count?: number;
  downloads_count?: number;
  favorites_count?: number;
  is_public?: boolean | null;
  is_favorite?: boolean;
  url: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
}

export interface Tone3000Model {
  id: number;
  name: string;
  model_url: string;
  size?: string;
  tone_id: number;
  architecture_version?: Tone3000Architecture | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ToneSearchParams {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: Tone3000Sort;
  gears?: Tone3000Gear[];
  sizes?: string[];
  tags?: string[];
  makes?: string[];
  creators?: string[];
  format?: Tone3000Format;
  architecture?: Tone3000Architecture;
  calibrated?: boolean;
  verified?: boolean;
}

export type CaptureType =
  | "amp-head"
  | "amp-and-cab"
  | "pedal"
  | "cabinet-ir"
  | "cabinet-capture"
  | "outboard"
  | "space"
  | "experimental"
  | "other";

export interface NormalizedTone {
  id: number;
  title: string;
  author: string | null;
  verifiedAuthor: boolean;
  captureType: CaptureType;
  gear: string;
  format: string;
  description: string | null;
  directUrl: string;
  imageUrl: string | null;
  makes: string[];
  tags: string[];
  modelCount: number;
  downloads: number;
  favorites: number;
  requiresCabOrIr: boolean;
  alreadyContainsCabinet: boolean;
  cabWarning: string | null;
  models?: Tone3000Model[];
}
