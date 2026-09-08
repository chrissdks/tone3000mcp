# Guitar Tone Assistant

Guitar Tone Assistant is a local Model Context Protocol (MCP) server that helps a compatible AI assistant find TONE3000 captures and plan practical guitar rigs using TONE3000, Neural Amp Modeler (NAM), cabinet impulse responses, and AmpliTube 5 MAX.

It is best understood as a **tone-planning and discovery assistant**. It recommends signal chains, starting settings, captures, cabinets, and troubleshooting steps. It does not process guitar audio itself.

> [!IMPORTANT]
> This repository is an early local MVP. Use the stdio transport on a trusted computer. The HTTP transport currently has no caller authentication and must not be exposed through a public tunnel, shared network, or public deployment.

## What it can and cannot do

Guitar Tone Assistant can:

- Search live TONE3000 tone packs and cabinet IRs when an API credential is configured.
- Explain whether a capture includes an amp, an amp and cabinet, or only a cabinet IR.
- Suggest TONE3000-focused, AmpliTube-only, and hybrid workflows.
- Search a small, curated local AmpliTube 5 MAX knowledge layer.
- Suggest starting settings and adjust them for guitar, pickup type, and tuning.
- Troubleshoot fizz, mud, harshness, boom, thinness, excessive compression, and weak pick attack.
- Compare two to four TONE3000 captures.
- Store an optional local description of the user's rig.

It does **not**:

- Listen to, analyze, transform, or play guitar audio.
- Load or execute NAM model files.
- Control a DAW or AmpliTube.
- Create AmpliTube preset files.
- Reproduce a recorded artist tone exactly.
- Contain the complete AmpliTube 5 MAX v2 catalog.
- Automatically apply a saved user profile to every recommendation.

Artist and album references are treated as useful starting points, not claims about exact studio equipment or settings.

## Who this is for

The current MVP is aimed at guitarists who already use, or want to experiment with:

- [TONE3000](https://www.tone3000.com/) for NAM captures and impulse responses.
- A NAM-compatible player or plugin.
- AmpliTube 5 MAX for adjustable amp, cabinet, microphone, and effects chains.
- A DAW or plugin host capable of arranging multiple plugins.
- ChatGPT desktop, Codex CLI, the Codex IDE extension, or another MCP client.

Developers can also use the project as a starting point for a more complete guitar-tone MCP server.

## The routing concepts that matter

| Result | What it represents | What normally follows it |
| --- | --- | --- |
| `amp` NAM capture | A fixed snapshot of an amplifier without cabinet coloration | Cabinet simulator or IR loader |
| `amp-cab` NAM capture | A fixed snapshot containing both amplifier and cabinet coloration | Post-EQ, delay, or reverb; no additional cab by default |
| `ir` or cabinet result | Cabinet and microphone coloration | Use after an amp-only NAM capture or amp simulation |
| AmpliTube amp model | A continuously adjustable amp simulation | AmpliTube cabinet/microphone section or another compatible cab stage |

Applying a cabinet to an `amp-cab` capture usually creates a muffled or phase-heavy **double-cab** sound. The server calls out this risk when the TONE3000 metadata is clear enough.

NAM captures are fixed snapshots. Turning a post-EQ control is not the same as changing the captured amplifier's original gain, tone stack, or master volume.

## How to use the three workflows

### TONE3000-focused

Typical DAW chain:

```text
Guitar -> Audio interface -> Gate/boost (optional) -> NAM player -> Cab/IR when required -> Post-EQ -> Delay/reverb
```

If the selected capture is `amp-cab`, skip the separate cabinet or IR unless you intentionally want that coloration.

### AmpliTube-only

Typical chain inside AmpliTube:

```text
Guitar -> Gate/boost -> AmpliTube amp -> AmpliTube cabinet and microphones -> Rack effects
```

This workflow offers continuously adjustable amp controls and does not require a NAM player.

### Hybrid

A NAM player cannot be inserted inside a single AmpliTube instance. A practical hybrid DAW chain normally uses separate plugin slots:

```text
AmpliTube instance 1 for pre-effects
-> NAM-compatible player for the TONE3000 capture
-> AmpliTube instance 2 for cabinet and post-effects
```

Disable unused amp or cabinet blocks in each AmpliTube instance. The exact routing depends on the DAW and NAM player; the MCP server returns guidance but does not configure those applications.

## Example requests

- “Find a tight 5150-style TONE3000 amp capture and pair it with a cabinet IR.”
- “Give me a TONE3000-only, AmpliTube-only, and hybrid version of this tone.”
- “I use a Les Paul with humbuckers in Drop C. Give me a modern metal starting point.”
- “This amp-and-cab capture sounds fizzy through my current chain. What should I change first?”
- “Compare these three TONE3000 links and tell me which one is most flexible.”
- “Give me a clean American combo-style tone.”

The returned knob values are starting points on a 0–10 scale. They are not guaranteed to match the labels or ranges of every physical or AmpliTube model.

## Included MCP tools

| Tool | Purpose |
| --- | --- |
| `search_tone3000` | Search and rank live TONE3000 tone packs with direct page links. |
| `get_tone3000_tone` | Resolve an ID or URL, classify the capture, and list model metadata and download URLs. |
| `search_tone3000_cabs` | Find cabinet IRs by speaker, size, and character. |
| `search_amplitube_gear` | Search the curated local AmpliTube 5 MAX starter catalog. |
| `recommend_tone_chain` | Return TONE3000-focused, AmpliTube-only, and hybrid approaches. |
| `troubleshoot_tone` | Give prioritized changes for common tone problems. |
| `compare_tones` | Compare capture requirements, gain/EQ clues, flexibility, and likely uses. |
| `get_user_tone_profile` | Read an optional local rig profile. |
| `save_user_tone_profile` | Replace an optional local rig profile. |

Every tool has Zod input/output schemas and MCP annotations. The schemas describe the tool contract; the current TONE3000 client does not yet perform full runtime validation of every upstream response.

## Requirements

- Node.js 20 or newer.
- npm.
- A compatible MCP client.
- A TONE3000 account and secret key for live TONE3000 tools.
- A NAM-compatible player and DAW/plugin host to use downloaded NAM models.
- AmpliTube 5 MAX only if you want to build the suggested AmpliTube chains.

Local AmpliTube search, recommendations, and troubleshooting can work without a TONE3000 credential. Live TONE3000 tools will return a configuration error, and recommendations will state that live candidates are unavailable.

## Install and verify

```powershell
npm install
Copy-Item .env.example .env
```

Open [TONE3000 settings](https://www.tone3000.com/settings), generate API credentials, and put the **secret key** in `.env`:

```dotenv
TONE3000_SECRET_KEY=t3k_cs_replace_me
```

The secret key is a server-only Bearer credential. Never place it in browser code, a public repository, MCP tool output, logs, or a publicly reachable server.

Build and run the automated tests:

```powershell
npm run build
npm test
```

## Run locally with stdio

Stdio is the recommended transport for this MVP because it does not open a network listener:

```powershell
npm run build
node dist/src/index.js
```

### Connect to Codex or ChatGPT desktop

Codex CLI, the Codex IDE extension, and ChatGPT desktop can use locally configured MCP servers. Add the built stdio server with the CLI:

```powershell
codex mcp add guitar-tone-assistant --env TONE3000_SECRET_KEY=t3k_cs_replace_me -- node C:\absolute\path\to\Tone3000mcp\dist\src\index.js
```

Alternatively, create a project-scoped `.codex/config.toml` in a trusted project:

```toml
[mcp_servers.guitar-tone-assistant]
command = "node"
args = ["C:/absolute/path/to/Tone3000mcp/dist/src/index.js"]
cwd = "C:/absolute/path/to/Tone3000mcp"
env_vars = ["TONE3000_SECRET_KEY"]
```

Do not put the secret value directly in `config.toml`; forward it from the local environment. Run `codex mcp list` or enter `/mcp` in a supported client to verify the connection.

See the official [ChatGPT and Codex MCP configuration guide](https://learn.chatgpt.com/docs/extend/mcp) for current client instructions.

## HTTP transport: local development only

The repository also includes a stateless Streamable HTTP transport:

```powershell
npm run build
node dist/src/http.js
```

The endpoint is `http://localhost:8787/mcp`, and `GET /` returns a credential-safe health response. It can be inspected locally with:

```powershell
npx @modelcontextprotocol/inspector@latest
```

Select Streamable HTTP and enter `http://localhost:8787/mcp`.

> [!WARNING]
> The current HTTP implementation has no caller authentication, permits every CORS origin, exposes profile read/write tools, and does not explicitly bind to loopback. Do not expose it with ngrok, Cloudflare Tunnel, router port forwarding, a public cloud deployment, or an untrusted LAN.

A shareable or published version must first authenticate MCP callers, verify authorization on every request, restrict its network and CORS policy, and replace the single shared TONE3000 credential with an appropriate per-user flow. OpenAI documents OAuth 2.1 as the expected authorization pattern for authenticated plugin MCP servers: [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth).

## TONE3000 API behavior and publishing constraints

Verified against the official documentation on 2026-09-07:

- API v1 base: `https://www.tone3000.com/api/v1`.
- A secret key is a server-only Bearer credential.
- User-facing integrations should use OAuth 2.0 with PKCE.
- Search uses `GET /tones/search`; detail uses `GET /tones/{id}`; models use `GET /models?tone_id={id}`.
- A tone's API-provided `url` is returned rather than guessing a public page route.
- Model `model_url` downloads require the Bearer credential.
- The default limit is 100 requests per minute, while search is more heavily restricted.
- TONE3000 recommends its Select OAuth flow for production browsing.
- Free and commercial integrations have different endpoint and review requirements.

Review the current [TONE3000 API documentation, design requirements, and commercial terms](https://www.tone3000.com/api) before publishing or monetizing an integration. The current global-secret search implementation is intended for trusted local evaluation, not a shared public service.

## AmpliTube catalog scope

The runtime catalog at [`src/data/amplitube5max.json`](src/data/amplitube5max.json) contains 19 curated starter records. It is not a complete representation of the 435 models listed for AmpliTube 5 MAX v2.

Each runtime record includes mapping confidence and an official source URL. A mapping labeled `not-stated` or `inferred` must not be treated as an exact product identity.

The repository also contains a researched cross-reference for an earlier 420-item AmpliTube 5 MAX inventory:

- [`docs/research/amplitube-max-cross-reference.md`](docs/research/amplitube-max-cross-reference.md)
- [`docs/research/amplitube-max-cross-reference.json`](docs/research/amplitube-max-cross-reference.json)

That research is not yet integrated into the runtime search catalog. Edition, ownership, microphone, alias, pagination, and model-specific control coverage remain future work.

Official product reference: [IK Multimedia AmpliTube 5](https://www.ikmultimedia.com/products/amplitube5/).

## User profiles

Profiles are optional local JSON records for guitars, pickups, tunings, interface, favorite amps/IRs, AmpliTube ownership, and monitoring equipment.

Saving a profile does not automatically cause `recommend_tone_chain` to load it. An MCP client must currently read the profile and pass relevant guitar, pickup, tuning, or workflow information into a recommendation request.

The profile store is designed for one trusted local process. It is not suitable for concurrent or multi-user hosting.

## Project structure

```text
src/index.ts                    stdio entry point
src/http.ts                     Streamable HTTP development entry point
src/server.ts                   MCP tool definitions and schemas
src/tone3000/                   TONE3000 API client, types, cache, and normalization
src/amplitube/                  Local AmpliTube search and types
src/recommendation/             Recommendation, comparison, and troubleshooting rules
src/profile/                    Local profile storage
src/data/amplitube5max.json     19-record runtime starter catalog
tests/                          Automated unit tests
docs/research/                  Catalog research and repository review notes
```

The service is intentionally modular: TONE3000 access is isolated from the recommendation engine, and another gear platform can be added alongside `src/amplitube`.

## Current limitations and roadmap

The main work required before a public release is:

1. Add MCP caller authentication and bind/restrict the HTTP server safely.
2. Implement TONE3000 per-user OAuth/Select rather than sharing one server credential.
3. Validate all upstream API responses before caching or processing them.
4. Make profile storage safe for reserved IDs and concurrent writes.
5. Integrate a complete, versioned AmpliTube 5 MAX v2 catalog with microphones and aliases.
6. Generate settings from each model's real control names and ranges.
7. Make saved profiles influence recommendations automatically.
8. Add DAW- and NAM-player-aware routing instructions.
9. Add HTTP, malformed-response, profile-concurrency, and full-catalog tests.

For detailed review evidence, see [`docs/research/code-review-2026-09-07.md`](docs/research/code-review-2026-09-07.md).

## Status

This repository is suitable for local experimentation and MCP development. It is not currently suitable for anonymous public hosting, multi-user profile storage, or authoritative coverage of the full AmpliTube 5 MAX v2 product catalog.
