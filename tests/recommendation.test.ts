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
    const amplitube = recommendation.approaches.find((item) => item.workflow === "amplitube")!;
    expect(amplitube.amplitubeGear.map((item) => item.displayName)).toContain(expectedAmp);
    expect(amplitube.settings.gain).toBeGreaterThanOrEqual(0);
    expect(recommendation.caveats.join(" ")).toMatch(/starting points/i);
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
