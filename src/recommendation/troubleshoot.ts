import type { TroubleshootAdjustment } from "./types.js";

const fixes: Record<string, Omit<TroubleshootAdjustment, "priority">[]> = {
  fizzy: [
    { action: "Move or filter the cabinet top end", exactChange: "Move a 57-style mic 1–2 cm toward the cone edge, or set a 9 kHz high cut and sweep down toward 7.5 kHz only if needed.", why: "Cab/mic choice usually creates more fizz than the amp EQ." },
    { action: "Reduce presence", exactChange: "Lower Presence by 1.0/10; then lower Treble by 0.5/10 if the attack remains scratchy.", why: "Presence targets the power-amp high-frequency feedback region and can exaggerate hash." },
    { action: "Check gain staging", exactChange: "Reduce interface input until hard picking never clips; reduce amp gain by 0.5–1.0/10 and level-match with output/master.", why: "Unwanted clipping and excessive preamp gain add broadband high-frequency distortion." },
    { action: "Use a narrow post-EQ only after the broad fixes", exactChange: "Sweep a Q 2–4 bell between 3.5 and 5.5 kHz, then cut the worst point by 1–2 dB.", why: "A small focused cut preserves pick definition better than a severe low-pass filter." }
  ],
  muddy: [
    { action: "Tighten before the amp", exactChange: "Set OD Drive 0.5/10, Tone 5/10, Level 8/10; reduce amp Bass by 1/10.", why: "Reducing low frequencies before distortion prevents intermodulation mush." },
    { action: "Apply a post-cab low cut", exactChange: "Start at 75 Hz; move toward 90 Hz in a dense mix.", why: "Removes sub/rumble without thinning the guitar's main body." },
    { action: "Clear low mids", exactChange: "Cut 250–350 Hz by 1–2 dB with a broad Q around 1.", why: "This range often accumulates boxiness across layered guitars." }
  ],
  thin: [
    { action: "Undo excessive filtering", exactChange: "Lower the low-cut frequency toward 65–75 Hz and raise amp Bass by 0.5/10.", why: "Aggressive filtering can remove body before other adjustments are judged." },
    { action: "Add low-mid body", exactChange: "Boost 180–300 Hz by 1 dB with a broad Q, or move the mic slightly farther from the dust-cap center.", why: "This restores weight without relying on sub bass." },
    { action: "Check phase and double tracking", exactChange: "Solo one cab/mic path; if it gains body, fix polarity/phase or use one mic before blending.", why: "Phase cancellation often sounds like an EQ problem." }
  ],
  harsh: [
    { action: "Soften the close mic position", exactChange: "Move the mic outward from the dust-cap center before changing amp EQ.", why: "The center position emphasizes upper mids and treble." },
    { action: "Reduce upper mids carefully", exactChange: "Sweep 2.5–4 kHz and cut 1–2 dB with Q 1.5–2.5.", why: "Harshness often lives below the fizzy top octave." },
    { action: "Back down Treble/Presence", exactChange: "Reduce Presence 0.5/10 and Treble 0.5/10, one move at a time.", why: "Small changes keep the tone from becoming dull." }
  ],
  boomy: [
    { action: "Reduce resonance and bass", exactChange: "Lower Resonance/Depth by 1/10 and Bass by 0.5/10.", why: "These controls can overload a close-miked 4x12 low end." },
    { action: "Raise the low cut", exactChange: "Move the high-pass filter from 70 Hz toward 85–100 Hz while listening in the mix.", why: "Leaves room for bass and kick while retaining guitar punch." },
    { action: "Check monitoring placement", exactChange: "Compare on headphones and move monitors away from walls/corners before committing a large EQ cut.", why: "Room modes can masquerade as a rig problem." }
  ],
  "too compressed": [
    { action: "Reduce gain", exactChange: "Lower amp gain by 1/10 and restore loudness with master/output.", why: "Preamp saturation is a major source of compression." },
    { action: "Ease the boost", exactChange: "Lower OD Level from 8/10 to 6.5/10 or bypass it; keep Drive near 0.", why: "A strong boost can flatten pick dynamics even with low drive." },
    { action: "Try a less saturated capture", exactChange: "Choose an amp-head capture labeled medium gain or crunch, then add only the gain needed downstream.", why: "NAM captures are fixed snapshots; their captured compression cannot be dialed out like a full amp model." }
  ],
  "not enough attack": [
    { action: "Tighten the input", exactChange: "Use OD Drive 0–0.5/10, Tone 5–6/10, Level 7–8/10 and reduce amp Bass 0.5/10.", why: "This removes slow low-frequency bloom before the gain stages." },
    { action: "Use less gain", exactChange: "Reduce amp gain by 0.5–1/10 and level-match with output.", why: "Too much saturation rounds transients." },
    { action: "Refine the cab/mic", exactChange: "Move the mic slightly toward the dust-cap edge, not the exact center, and try a tighter 4x12/speaker.", why: "Cabinet transients strongly affect perceived pick attack." }
  ]
};

function normalizeProblem(problem: string): string {
  const value = problem.toLowerCase();
  return Object.keys(fixes).find((key) => value.includes(key)) ?? value;
}

export function troubleshootTone(currentRig: string, problem: string): { problem: string; currentRig: string; adjustments: TroubleshootAdjustment[]; warning: string | null } {
  const key = normalizeProblem(problem);
  const selected = fixes[key] ?? [
    { action: "Level-match and isolate one stage", exactChange: "Bypass pedals, post effects, and extra cab/mic paths; add them back one at a time at matched loudness.", why: "This identifies which stage creates the problem before making compensating changes elsewhere." },
    { action: "Make one small move", exactChange: "Change the most relevant control by 0.5–1.0/10 and compare in the mix.", why: "Small controlled changes are easier to evaluate and reverse." }
  ];
  const lowerRig = currentRig.toLowerCase();
  const possibleDoubleCab = /(amp.?cab|full.?rig|cab included).*(cab|ir)|(cab|ir).*(amp.?cab|full.?rig|cab included)/i.test(lowerRig);
  return {
    problem,
    currentRig,
    adjustments: selected.map((item, index) => ({ priority: index + 1, ...item })),
    warning: possibleDoubleCab ? "Your description may include cabinet coloration twice. Bypass the downstream cab/IR and compare before further EQ." : null,
  };
}
