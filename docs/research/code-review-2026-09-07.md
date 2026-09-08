# Code and project review - 2026-09-07

Reviewed the current TypeScript MCP server, HTTP entry point, API client, profile storage, catalog/search, recommendation logic, and tests. This is a review, not an implementation of the proposed fixes. No production credentials or live TONE3000 requests were used.

## Findings, in priority order

### P1 - Local HTTP mode listens on all interfaces with no caller authentication

Location: `src/http.ts:49`, request handling at `src/http.ts:17-35`.

`listen(config.port)` omits the host. A direct Node probe on this machine returned `::` (the unspecified IPv6 address), not loopback. Network reachability still depends on the OS firewall. The log message containing `localhost` does not restrict the listener. The endpoint also allows all origins and exposes profile read/write tools without authenticating the caller. A reachable client can consume the configured TONE3000 credential through the exposed tools or read/replace profiles by ID. This is already relevant to local HTTP use, not just a future hosted service. Stdio mode does not open this HTTP listener.

Recommendation: default HTTP mode to `127.0.0.1`, make intentional remote binding explicit, validate Origin/Host as appropriate, and add access control before using a public tunnel or host. Profile IDs must be authorized against a user identity in a shared service. Extract a server factory so listener and request-boundary behavior can be tested.

Correction to earlier chat guidance: the source does **not** explicitly bind to localhost, and adding `0.0.0.0` is not the missing prerequisite previously claimed for hosting.

### P1 - Concurrent profile saves can corrupt the entire profile file

Location: `src/profile/store.ts:26-33`.

Each save reads a snapshot, writes to the same PID-based temporary file, then renames it. Concurrent calls can overwrite each other's snapshots and collide on the same temporary file. Two concurrent saves in the review both fulfilled but left invalid JSON. Even if unique temporary filenames were used, stale read/modify/write snapshots could still lose updates.

Recommendation: serialize the complete read-modify-write operation for a single process, use unique temporary filenames, and recover/report failures cleanly. Use a transactional store if multiple processes or hosted users will write. Add a regression that saves multiple distinct IDs concurrently and checks valid JSON and preservation of every record.

### P2 - Accepted profile IDs include prototype properties that do not behave as stored profiles

Location: `src/profile/store.ts:23,28`; profile ID validation in `src/server.ts`.

The accepted ID `__proto__` passes the regular expression. Assigning it into `{}` changes that object's prototype instead of creating a normal own property; saving reported success but the key was absent from the written JSON in the review. Reading an unsaved ID such as `constructor` can resolve an inherited property and fail output validation. This is an object-key handling bug, not evidence of global prototype pollution.

Recommendation: use own-property lookup and safe dictionary construction (or a database), and explicitly handle reserved keys. Test round trips for IDs accepted by the public schema.

### P2 - Valid JSON with an invalid API shape is cached and returned as trusted data

Location: `src/tone3000/client.ts:110-119`; callers use `response.data.map(...)` in `src/server.ts` and `src/recommendation/engine.ts`.

The cast `as T` performs no runtime validation. A mocked HTTP 200 response of `{"unexpected":true}` was accepted by `searchTones`. An API change or malformed payload then fails later with a generic error rather than a consistent `invalid_response`; the bad object is also cached. Existing tests only supply matching shapes. MCP output schemas do not replace upstream validation.

Recommendation: validate tone, model, and pagination responses before caching. Handle optional fields deliberately; keep unexpected upstream data out of user-facing exception messages. Add malformed-object and incomplete-pagination tests.

### P2 - AmpliTube-only recommendations still make a TONE3000 API request

Location: `src/recommendation/engine.ts:153-159`.

`findTones` executes before `preferredWorkflow` is used. A mocked request for `preferredWorkflow: "amplitube"` made one external request. This wastes API quota and can add the API timeout to an entirely local operation.

Recommendation: determine workflows first and only perform live search when one selected workflow needs it. Test with a fetch spy that must remain unused for AmpliTube-only requests.

### P2 - Catalog names and recipe identities are insufficiently grounded

Location: `src/data/amplitube5max.json:18,74`; `src/recommendation/engine.ts:30-34`.

The runtime has 19 entries; the linked inventory has 420. `American Tube Clean` is not an exact entry in that inventory: there are separate models 1 and 2. Metal Lead T is explicitly a Mesa/Boogie Triple Rectifier lead-channel model (IK manual p.255), but the Metallica recipe's upstream query targets Mesa Mark while its AmpliTube branch picks Metal Lead T without explaining the different amp family. This does not prove that a Rectifier cannot provide a useful approximation; it means the code's family selection is internally inconsistent.

Recommendation: use exact inventory names, separate hardware identities from descriptive tonal tags, preserve model-specific source pages, and make recipe substitutions explicit. See the companion 420-entry cross-reference. Preserve stable IDs during migration and validate recipe references.

### P2 - Recommended knob settings are not checked against selected model controls

Location: `src/recommendation/engine.ts:153-190`; `src/data/amplitube5max.json`.

The same generic gain/bass/mid/treble/presence/master structure is returned regardless of the selected amp, with a blanket 0-10 scale. For example, the manual's American Tube Clean 1/2 entries list Bass, Middle, Treble, Presence, Spring Reverb and Volume (pp.231-232), not a separate gain/master pair. Recipes can therefore ask a user to adjust a nonexistent control. The starter catalog's clean amp also omits Presence and lists controls differently from those manual pages.

Recommendation: represent model control names, units, ranges and any normalized-to-actual conversion separately. Emit only controls the selected gear exposes; distinguish pre/post EQ from amp controls. Keep subjective starting settings separate from documented hardware facts.

### P2 - Microphones cannot be searched even after adding microphone data

Location: `src/amplitube/types.ts:1`; `src/server.ts:118`.

The linked inventory includes 18 microphones, but both the type union and the tool's input enum omit microphones. Merely replacing the JSON catalog would not provide full gear coverage.

Recommendation: add a microphone category through data, TypeScript types, MCP schema and tests. For a full catalog, add pagination and exact-name/hardware aliases; the current result limit is capped at 25 with no offset.

## Additional gaps

- `listModels` fetches only page 1 (up to 300). Handle additional pages or explicitly return truncation/pagination metadata.
- Missing `Retry-After` becomes zero through `Number(null)`; HTTP-date values are ignored. Parse seconds and dates and preserve an absent value as absent.
- The recommendation recipes are a small ruleset rather than a general rig designer; `desiredGain` is only used by the fallback recipe. Define precedence for explicit user gain requests.
- Hybrid chains should name the required NAM-capable player and explain how to route its audio through AmpliTube; a TONE3000 search result is not itself an audio-processing block.
- Existing tests do not exercise the HTTP transport, profile persistence, catalog integrity, or most malformed upstream responses.
- Add CI for build/tests and catalog validation; pin a supported Node version and document the tested runtime. The inspected scripts/tests run successfully with Node 22.15.0, but other allowed Node versions were not verified.

## Suggested implementation order

1. Fix loopback defaults and profile storage correctness; add focused regression tests.
2. Validate upstream responses and avoid unnecessary live calls.
3. Integrate the researched catalog with stable IDs, microphone support, provenance, aliases and pagination. Leave unresolved speaker identities explicitly unresolved.
4. Make recommendations select verified gear and actual controls; explain substitutions and NAM player routing.
5. Add continuous checks. Plan hosted multi-user authentication and storage as a separate milestone when needed.

## Verification

- `npm test`: 13 tests passed across 3 files.
- `npm run build`: passed.
- `node scripts/review-checks.mjs`: confirmed corrupt concurrent profile writes, the reserved-key problem, malformed API response acceptance, an external call for an AmpliTube-only request, and default unspecified-interface binding. The concurrent-write outcome is timing dependent; the reproduced corruption is recorded above.
- Checks use mocked network responses and fresh temporary profile files. User profile data and real API credentials were not read or modified.
- The cross-reference generator asserts exactly 420 unique record IDs and all seven official category counts. It preserves the two duplicate-named inventory entries.

Research artifacts and review scripts were added locally. Application code was not modified; no commit, push or deployment was performed.
