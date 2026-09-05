import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface UserProfile {
  guitars?: string[];
  pickupTypes?: string[];
  tunings?: string[];
  audioInterface?: string;
  preferredGenres?: string[];
  favoriteAmps?: string[];
  preferredIrs?: string[];
  ownsAmplitube5Max?: boolean;
  outputDevice?: string;
}

type ProfileDocument = Record<string, UserProfile>;

export class ProfileStore {
  constructor(private readonly filePath: string) {}

  async get(profileId = "default"): Promise<UserProfile | null> {
    const profiles = await this.readAll();
    return profiles[profileId] ?? null;
  }

  async save(profile: UserProfile, profileId = "default"): Promise<UserProfile> {
    const profiles = await this.readAll();
    profiles[profileId] = profile;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(profiles, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
    return profile;
  }

  private async readAll(): Promise<ProfileDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ProfileDocument : {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw new Error("The local profile store could not be read.");
    }
  }
}
