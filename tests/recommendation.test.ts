import { describe, expect, it } from "vitest";
import { recommendToneChain } from "../src/recommendation/engine.js";
import { troubleshootTone } from "../src/recommendation/troubleshoot.js";
import { Tone3000Client } from "../src/tone3000/client.js";

const offlineClient = new Tone3000Client({ baseUrl: "https://www.tone3000.com/api/v1" });

describe("recommendation flows", () => {
  it.each([
    ["Metallica Black Album rhythm", "Metal Lead T"],
    ["Alice in Chains Jerry Cantrell Dirt-era rhythm", "SLD 100"],
    ["modern 5150 metal tone", "SJ50"],
    ["clean Fender-style tone", "American Tube Clean"],
  ])("builds three safe approaches for %s", async (target, expectedAmp) => {
    const recommendation = await recommendToneChain(offlineClient, { target });
    expect(recommendation.approaches.map((item) => item.workflow)).toEqual(["tone3000", "amplitube", "hybrid"]);
    expect(recommendation.recommendedWorkflow).toBe("amplitube");
    const amplitube = recommendation.approaches.find((item) => item.workflow === "amplitube")!;
    expect(amplitube.amplitubeGear.map((item) => item.displayName)).toContain(expectedAmp);
    expect(amplitube.settings.gain).toBeGreaterThanOrEqual(0);
    expect(recommendation.caveats.join(" ")).toMatch(/starting points/i);
  });

  it("chooses the AmpliTube plus TONE3000 IR workflow when cabinet flexibility is the priority", async () => {
    const recommendation = await recommendToneChain(offlineClient, { target: "adjustable modern metal tone", priority: "cabinet-flexibility", ownsAmplitube5Max: true });
    expect(recommendation.recommendedWorkflow).toBe("hybrid");
    const hybrid = recommendation.approaches.find((item) => item.workflow === "hybrid")!;
    expect(hybrid.deliveryKind).toBe("amplitube-instructions-and-tone3000-ir");
    expect(hybrid.signalChain.join(" ")).toMatch(/IR Loader/i);
  });

  it("does not search TONE3000 for an explicitly AmpliTube-only recommendation", async () => {
    let calls = 0;
    const client = new Tone3000Client({
      baseUrl: "https://www.tone3000.com/api/v1",
      secretKey: "test",
      fetchImpl: async () => { calls += 1; throw new Error("should not be called"); },
    });
    const recommendation = await recommendToneChain(client, { target: "clean tone", preferredWorkflow: "amplitube" });
    expect(recommendation.approaches).toHaveLength(1);
    expect(recommendation.recommendedWorkflow).toBe("amplitube");
    expect(calls).toBe(0);
  });

  it("compensates for a Les Paul with humbuckers", async () => {
    const baseline = await recommendToneChain(offlineClient, { target: "modern 5150 metal tone" });
    const adjusted = await recommendToneChain(offlineClient, { target: "modern 5150 metal tone", guitarType: "Les Paul", pickupType: "humbuckers" });
    expect(adjusted.approaches[0].settings.gain).toBe(baseline.approaches[0].settings.gain - 0.5);
    expect(adjusted.approaches[0].settings.bass).toBe(baseline.approaches[0].settings.bass - 0.5);
  });
});

describe("troubleshooting", () => {
  it("prioritizes cab/mic and gain staging for fizz", () => {
    const result = troubleshootTone("Noise Gate -> amp head -> 4x12 IR", "my tone is too fizzy");
    expect(result.adjustments[0].exactChange).toContain("9 kHz");
    expect(result.adjustments.map((item) => item.priority)).toEqual([1, 2, 3, 4]);
  });

  it("warns about a likely double cab", () => {
    const result = troubleshootTone("amp+cab capture -> cab IR", "harsh");
    expect(result.warning).toMatch(/cabinet coloration twice/i);
  });
});
