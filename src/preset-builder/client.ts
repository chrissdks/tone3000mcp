import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedPresetArtifact, PresetVoicing, Tone3000PresetRecipe } from "./types.js";

const BUILDER_RELATIVE_SCRIPT = path.join("skill", "tone3000-preset-builder", "scripts", "t3k.py");
const PRESET_EXTENSION = ".t3kpreset";
const T3K_MAGIC = Buffer.from("T3KB", "ascii");

export const PRESET_BUILDER_ATTRIBUTION =
  "Preset compilation powered by Tone3000 Preset Builder by Thomas Lennon (MIT License).";

export interface PresetBuilderConfig {
  rootPath: string;
  outputPath: string;
  pythonCommand: string;
  timeoutMs: number;
  tone3000SecretKey?: string;
  downloadBaseUrl?: string;
  commit?: string;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
) => Promise<ProcessResult>;

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Preset Builder timed out after ${options.timeoutMs} ms.`));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const output = { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") };
      if (code === 0) resolve(output);
      else reject(new Error(output.stderr.trim() || output.stdout.trim() || `Preset Builder exited with code ${code}.`));
    });
  });
}

function safeBuilderError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : "Preset Builder failed unexpectedly.";
  const redacted = raw
    .replace(/t3k_(?:cs|pub)_[A-Za-z0-9_-]+/g, "[REDACTED_TONE3000_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  return new Error(redacted.slice(0, 1000));
}

export class Tone3000PresetBuilder {
  private readonly scriptPath: string;

  constructor(
    readonly config: PresetBuilderConfig,
    private readonly runner: ProcessRunner = runProcess,
  ) {
    this.scriptPath = path.resolve(config.rootPath, BUILDER_RELATIVE_SCRIPT);
  }

  async assertAvailable(): Promise<void> {
    try {
      await access(this.scriptPath);
    } catch {
      throw new Error(
        "Tone3000 Preset Builder is unavailable. Initialize the pinned submodule with `git submodule update --init --recursive`.",
      );
    }
  }

  async create(recipe: Tone3000PresetRecipe, voicing: PresetVoicing): Promise<GeneratedPresetArtifact> {
    await this.assertAvailable();
    if (voicing === "stereo" && !recipe.stereo) {
      throw new Error("A stereo preset requires a right-chain definition.");
    }

    const artifactId = randomUUID().replaceAll("-", "");
    const artifactPath = path.resolve(this.config.outputPath, artifactId);
    await mkdir(artifactPath, { recursive: true });
    const recipePath = path.join(artifactPath, "recipe.json");
    await writeFile(recipePath, `${JSON.stringify(recipe, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

    const args = [
      this.scriptPath,
      "build",
      recipePath,
      "--out",
      artifactPath,
      "--named",
      voicing === "mono" ? "--mono-only" : "--stereo-only",
    ];
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (this.config.tone3000SecretKey && !env.T3K_SECRET_KEY && !env.T3K_ACCESS_TOKEN && !env.T3K_API_KEY) {
      env.T3K_SECRET_KEY = this.config.tone3000SecretKey;
    }

    try {
      await this.runner(this.config.pythonCommand, args, {
        cwd: this.config.rootPath,
        env,
        timeoutMs: this.config.timeoutMs,
      });

      const fileNames = (await readdir(artifactPath)).filter((fileName) => fileName.endsWith(PRESET_EXTENSION));
      if (fileNames.length === 0) throw new Error("Preset Builder completed without producing a .t3kpreset file.");

      for (const fileName of fileNames) {
        const filePath = path.join(artifactPath, fileName);
        const header = (await readFile(filePath)).subarray(0, T3K_MAGIC.length);
        if (!header.equals(T3K_MAGIC)) throw new Error(`Generated preset ${fileName} has an invalid file header.`);
        const verification = await this.runner(this.config.pythonCommand, [this.scriptPath, "verify", filePath], {
          cwd: this.config.rootPath,
          env,
          timeoutMs: this.config.timeoutMs,
        });
        if (!/^OK\s*$/m.test(verification.stdout)) throw new Error(`Generated preset ${fileName} failed verification.`);
      }

      const files = await Promise.all(fileNames.map(async (fileName) => ({
        fileName,
        localPath: await realpath(path.join(artifactPath, fileName)),
        downloadUrl: this.config.downloadBaseUrl
          ? `${this.config.downloadBaseUrl.replace(/\/$/, "")}/presets/${artifactId}/${encodeURIComponent(fileName)}`
          : null,
      })));

      return {
        artifactId,
        recipe,
        files,
        builderCommit: this.config.commit ?? "pinned-git-submodule",
        attribution: PRESET_BUILDER_ATTRIBUTION,
      };
    } catch (error) {
      throw safeBuilderError(error);
    }
  }

  async resolveDownload(artifactId: string, fileName: string): Promise<string> {
    if (!/^[a-f0-9]{32}$/.test(artifactId) || !/^[^\\/\r\n\"]+\.t3kpreset$/i.test(fileName)) {
      throw new Error("Invalid preset download path.");
    }
    const outputRoot = path.resolve(this.config.outputPath);
    const candidate = path.resolve(outputRoot, artifactId, fileName);
    if (!candidate.startsWith(`${outputRoot}${path.sep}`)) throw new Error("Invalid preset download path.");
    const [rootRealPath, candidateRealPath] = await Promise.all([realpath(outputRoot), realpath(candidate)]);
    if (!candidateRealPath.startsWith(`${rootRealPath}${path.sep}`)) throw new Error("Invalid preset download path.");
    const metadata = await stat(candidateRealPath);
    if (!metadata.isFile()) throw new Error("Preset download was not found.");
    return candidateRealPath;
  }
}
