import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(root, "docs", "research", "amplitube-max-v2-inventory.json");
const legacyPath = path.join(root, "docs", "research", "amplitube-max-cross-reference.json");
const curatedPath = path.join(root, "src", "data", "amplitube5max.curated.json");
const outputPath = path.join(root, "src", "data", "amplitube5max.json");
const reconciliationPath = path.join(root, "docs", "research", "amplitube-max-v2-reconciliation.json");

const [inventory, legacy, curated] = await Promise.all(
  [inventoryPath, legacyPath, curatedPath].map(async (sourcePath) => JSON.parse(await readFile(sourcePath, "utf8"))),
);

function key(value) {
  return value
    .normalize("NFKD")
    .replace(/[®™]/g, "")
    .replace(/[‘’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const curatedNameAliases = new Map([
  ["amp:americantubeclean1", "americantubeclean"],
]);
const legacyNameAliases = new Map([
  ["cabinet:4x121960av", "4x121960avsl"],
  ["cabinet:4x121960bv", "4x121960bvsl"],
]);
const laRockerUrl = "https://www.ikmultimedia.com/products/larocker/";
const mesa2Url = "https://www.ikmultimedia.com/products/mesa2/";
const xGearUrl = "https://www.ikmultimedia.com/products/xgear/";
const authoritativeOverrides = new Map([
  ["stomp:ddelay", { collection: "AmpliTube L.A. Rocker", sourceUrl: laRockerUrl }],
  ["stomp:xdrive", { collection: "AmpliTube X-GEAR", sourceUrl: xGearUrl, mappingConfidence: "original", role: "distortion, overdrive, fuzz, compression, and boost" }],
  ["stomp:xtime", { collection: "AmpliTube X-GEAR", sourceUrl: xGearUrl, mappingConfidence: "original", role: "delay" }],
  ["stomp:xspace", { collection: "AmpliTube X-GEAR", sourceUrl: xGearUrl, mappingConfidence: "original", role: "reverb" }],
  ["stomp:xvibe", { collection: "AmpliTube X-GEAR", sourceUrl: xGearUrl, mappingConfidence: "original", role: "modulation" }],
  ["amp:brit100mod3436", { collection: "AmpliTube L.A. Rocker", sourceUrl: laRockerUrl, hardwareEquivalent: "Marshall AFD100 amplifier", mappingConfidence: "official", pairings: ["cabinet-4x121960avsl-1", "cabinet-4x121960bvsl-1"] }],
  ["amp:britlagold", { collection: "AmpliTube L.A. Rocker", sourceUrl: laRockerUrl, hardwareEquivalent: "1987 Marshall Jubilee 2555 amplifier", mappingConfidence: "official", pairings: ["cabinet-4x121960avsl-1", "cabinet-4x121960bvsl-1"] }],
  ["amp:californiatweed", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie California Tweed", mappingConfidence: "official" }],
  ["amp:markiic", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie Mark IIC+", mappingConfidence: "official" }],
  ["amp:markv", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie Mark V", mappingConfidence: "official" }],
  ["amp:triplecrow", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie Triple Crown", mappingConfidence: "official", aliases: ["Triple Crown"], notes: "The MAX v2 inventory spells this model 'Triple Crow'; the official collection page calls it 'Triple Crown'." }],
  ["cabinet:1x12californiatweed", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie 1x12 California cabinet", mappingConfidence: "official" }],
  ["cabinet:2x12californiatweed", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie 2x12 California cabinet", mappingConfidence: "official" }],
  ["cabinet:2x12roadking", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie 2x12 Road King cabinet", mappingConfidence: "official" }],
  ["cabinet:4x12roadkingblack", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie 4x12 Road King Black cabinet", mappingConfidence: "official" }],
  ["cabinet:4x12roadkingvintage", { collection: "AmpliTube MESA/Boogie 2", sourceUrl: mesa2Url, hardwareEquivalent: "MESA/Boogie 4x12 Road King Vintage cabinet", mappingConfidence: "official" }],
]);

function takeMatch(records, used, category, name, aliases = new Map()) {
  const target = aliases.get(`${category}:${key(name)}`) ?? key(name);
  const index = records.findIndex((item, candidateIndex) =>
    !used.has(candidateIndex)
      && (item.category ?? item.type) === category
      && key(item.displayName) === target,
  );
  if (index < 0) return undefined;
  used.add(index);
  return records[index];
}

const usedLegacy = new Set();
const usedCurated = new Set();
const idCounts = new Map();
const matchedLegacy = [];
const gear = inventory.gear.map((official) => {
  const legacyItem = takeMatch(legacy.gear, usedLegacy, official.category, official.displayName, legacyNameAliases);
  const curatedItem = takeMatch(curated, usedCurated, official.category, official.displayName, curatedNameAliases);
  const authoritative = authoritativeOverrides.get(`${official.category}:${key(official.displayName)}`);
  const baseId = `${official.category}-${key(official.displayName) || "gear"}`;
  const occurrence = (idCounts.get(baseId) ?? 0) + 1;
  idCounts.set(baseId, occurrence);
  const id = curatedItem?.id ?? legacyItem?.id ?? `${baseId}-${occurrence}`;
  const aliases = unique([
    ...(authoritative?.aliases ?? []),
    ...(curatedItem?.aliases ?? []),
    curatedItem?.displayName !== official.displayName ? curatedItem?.displayName : undefined,
    legacyItem?.displayName !== official.displayName ? legacyItem?.displayName : undefined,
    legacyItem?.manualName !== official.displayName ? legacyItem?.manualName : undefined,
  ]);
  const notes = unique([authoritative?.notes, legacyItem?.notes, curatedItem?.notes]).join(" ") || undefined;
  if (legacyItem) matchedLegacy.push({ official, legacyItem });

  return {
    id,
    displayName: official.displayName,
    type: official.category,
    collection: authoritative?.collection ?? curatedItem?.collection,
    includedIn: [inventory.product],
    inventoryVersion: inventory.inventoryVersion,
    inventoryPage: official.inventoryPage,
    inventorySourceUrl: inventory.inventoryUrl,
    hardwareEquivalent: authoritative?.hardwareEquivalent ?? legacyItem?.hardwareEquivalent ?? undefined,
    modeledFamily: curatedItem?.modeledFamily,
    mappingConfidence: authoritative?.mappingConfidence ?? legacyItem?.mappingConfidence ?? curatedItem?.mappingConfidence ?? "not-stated",
    aliases,
    gainClass: curatedItem?.gainClass,
    tonalCharacter: curatedItem?.tonalCharacter ?? [],
    controls: curatedItem?.controls ?? [],
    styles: curatedItem?.styles ?? [],
    pairings: authoritative?.pairings ?? curatedItem?.pairings ?? [],
    cabinetSize: curatedItem?.cabinetSize,
    speakerFamily: curatedItem?.speakerFamily,
    role: authoritative?.role ?? curatedItem?.role,
    notes,
    manualPage: legacyItem?.manualPage ?? undefined,
    sourceUrl: authoritative?.sourceUrl ?? curatedItem?.sourceUrl ?? inventory.inventoryUrl,
  };
});

const actualCounts = Object.fromEntries(
  Object.keys(inventory.categoryCounts).map((category) => [category, gear.filter((item) => item.type === category).length]),
);
assert.equal(gear.length, inventory.total);
assert.deepEqual(actualCounts, inventory.categoryCounts);
assert.equal(new Set(gear.map((item) => item.id)).size, gear.length);
assert.equal(usedCurated.size, curated.length, "Every curated record must map into the official MAX v2 inventory.");

const payload = {
  schemaVersion: 1,
  product: inventory.product,
  inventoryVersion: inventory.inventoryVersion,
  inventoryUpdated: inventory.inventoryUpdated,
  inventorySourceUrl: inventory.inventoryUrl,
  categoryCounts: inventory.categoryCounts,
  total: inventory.total,
  gear,
};
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
const reconciliation = {
  from: legacy.scope,
  to: `${inventory.product}; inventory version ${inventory.inventoryVersion}`,
  matched: matchedLegacy.length,
  added: inventory.gear.filter((official) => !matchedLegacy.some(({ official: matched }) => matched === official)),
  removed: legacy.gear.filter((_, index) => !usedLegacy.has(index)).map(({ category, displayName, id }) => ({ category, displayName, id })),
  renamed: matchedLegacy
    .filter(({ official, legacyItem }) => official.displayName !== legacyItem.displayName)
    .map(({ official, legacyItem }) => ({
      category: official.category,
      from: legacyItem.displayName,
      to: official.displayName,
    })),
};
await writeFile(reconciliationPath, `${JSON.stringify(reconciliation, null, 2)}\n`, "utf8");
console.log(`Wrote ${gear.length} AmpliTube 5 MAX v2 records to ${outputPath}`);
console.log(`Reconciled ${reconciliation.matched}; added ${reconciliation.added.length}; removed ${reconciliation.removed.length}; renamed ${reconciliation.renamed.length}.`);
