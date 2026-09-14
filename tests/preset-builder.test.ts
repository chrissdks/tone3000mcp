import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Tone3000PresetBuilder, type ProcessRunner } from "../src/preset-builder/client.js";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, { recursive: true, force: true })));
});

describe("Tone3000PresetBuilder", () => {
  it("delegates compilation and verification to the pinned external CLI", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "guitar-tone-preset-"));
    temporaryPaths.push(temporaryRoot);
    const builderRoot = path.join(temporaryRoot, "builder");
    const scriptPath = path.join(builderRoot, "skill", "tone3000-preset-builder", "scripts", "t3k.py");
    await mkdir(path.dirname(scriptPath), { recursive: true });
    await writeFile(scriptPath, "# test fixture\n", "utf8");

    const calls: string[][] = [];
    const runner: ProcessRunner = async (_command, args) => {
      calls.push(args);
      if (args.includes("build")) {
        const outputPath = args[args.indexOf("--out") + 1];
        await writeFile(path.join(outputPath, "Test Tone.t3kpreset"), Buffer.from("T3KBfixture", "ascii"));
        return { stdout: "DONE — 1 preset file(s) written, 0 failed verification\n", stderr: "" };
      }
      return { stdout: "OK\n", stderr: "" };
    };

    const builder = new Tone3000PresetBuilder({
      rootPath: builderRoot,
      outputPath: path.join(temporaryRoot, "generated"),
      pythonCommand: "python",
      timeoutMs: 1_000,
      tone3000SecretKey: "test-secret",
      downloadBaseUrl: "http://127.0.0.1:8787",
      commit: "test-commit",
    }, runner);

    const artifact = await builder.create({ name: "Test Tone", chain: [{ tone: 42, model: "Lead" }] }, "mono");
    expect(artifact.builderCommit).toBe("test-commit");
    expect(artifact.attribution).toContain("Thomas Lennon");
    expect(artifact.files).toHaveLength(1);
    expect(artifact.files[0].downloadUrl).toContain(`/presets/${artifact.artifactId}/Test%20Tone.t3kpreset`);
    expect((await readFile(artifact.files[0].localPath)).subarray(0, 4).toString("ascii")).toBe("T3KB");
    expect(await builder.resolveDownload(artifact.artifactId, artifact.files[0].fileName)).toBe(artifact.files[0].localPath);
    expect(calls[0]).toContain("--mono-only");
    expect(calls[1]).toContain("verify");
  });

  it("requires a right chain for stereo output", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "guitar-tone-preset-"));
    temporaryPaths.push(temporaryRoot);
    const scriptPath = path.join(temporaryRoot, "skill", "tone3000-preset-builder", "scripts", "t3k.py");
    await mkdir(path.dirname(scriptPath), { recursive: true });
    await writeFile(scriptPath, "# test fixture\n", "utf8");
    const builder = new Tone3000PresetBuilder({ rootPath: temporaryRoot, outputPath: path.join(temporaryRoot, "generated"), pythonCommand: "python", timeoutMs: 1_000 });
    await expect(builder.create({ name: "Invalid Stereo", chain: [{ tone: 42 }] }, "stereo")).rejects.toThrow(/right-chain/i);
  });
});
