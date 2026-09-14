# Guitar Tone Assistant

Guitar Tone Assistant is a local Model Context Protocol (MCP) server that helps a compatible AI assistant design and deliver practical guitar tones using the TONE3000 plugin, Neural Amp Modeler (NAM), cabinet impulse responses, and AmpliTube 5 MAX.

The MCP server is the **tone-design brain**. It interprets the player's goal and rig, chooses the most useful workflow, and can return either a ready-to-load TONE3000 plugin preset, AmpliTube build instructions, or an adjustable AmpliTube amp paired with a TONE3000 cabinet IR. It does not process guitar audio itself.

> [!IMPORTANT]
> This repository is an early local MVP. Use the stdio transport on a trusted computer. The HTTP transport binds to loopback by default but has no caller authentication, so it must not be exposed through a public tunnel, shared network, or public deployment.

## What it can and cannot do

Guitar Tone Assistant can:

- Search live TONE3000 tone packs and cabinet IRs when an API credential is configured.
- Explain whether a capture includes an amp, an amp and cabinet, or only a cabinet IR.
- Decide between TONE3000-plugin, AmpliTube-only, and hybrid delivery based on the player's software and priorities.
- Compile exact selected TONE3000 tone/model IDs into a verified native `.t3kpreset` file.
- Return a local file path over stdio or a localhost download link over the HTTP transport.
- Search a small, curated local AmpliTube 5 MAX knowledge layer.
- Suggest starting settings and adjust them for guitar, pickup type, and tuning.
- Troubleshoot fizz, mud, harshness, boom, thinness, excessive compression, and weak pick attack.
- Compare two to four TONE3000 captures.
- Store an optional local description of the user's rig.

It does **not**:

- Listen to, analyze, transform, or play guitar audio.
- Load, install, or execute the generated preset or model files for the user.
- Control a DAW or AmpliTube.
- Create AmpliTube preset files.
- Reproduce a recorded artist tone exactly.
- Contain the complete AmpliTube 5 MAX v2 catalog.
- Automatically apply a saved user profile to every recommendation.

Artist and album references are treated as useful starting points, not claims about exact studio equipment or settings.

## Who this is for

The current MVP is aimed at guitarists who already use, or want to experiment with:

- [TONE3000](https://www.tone3000.com/) for NAM captures and impulse responses.
- The official [TONE3000 plugin](https://www.tone3000.com/guides/tone3000-plugin) for ready-to-load multi-block presets, or another NAM-compatible player for manual chains.
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

The assistant selects exact TONE3000 tone/model IDs and can ask the bundled compiler adapter to produce a native `.t3kpreset` file. The user then loads that file in the TONE3000 plugin. A typical internal chain is:

```text
Guitar -> Audio interface -> TONE3000 plugin
  [Gate/boost as captured or hosted] -> Amp capture -> Cab/IR when required -> Tone EQ
```

If the selected capture is `amp-cab`, the assistant skips a separate cabinet by default to avoid double-cab coloration. Preset compilation requires exact TONE3000 IDs; recommendations remain separate from compilation so the assistant can explain the choice before creating a file.

### AmpliTube-only

Typical chain inside AmpliTube:

```text
Guitar -> Gate/boost -> AmpliTube amp -> AmpliTube cabinet and microphones -> Rack effects
```

This workflow offers continuously adjustable amp controls and does not require a NAM player.

### Hybrid

The default hybrid keeps AmpliTube's amp controls adjustable while using a TONE3000 cabinet IR in AmpliTube's IR Loader:

```text
Guitar -> AmpliTube gate/boost -> AmpliTube amp
-> AmpliTube IR Loader with a TONE3000 .wav cabinet IR
-> AmpliTube post-EQ, delay, and reverb
```

Disable AmpliTube's normal cabinet block while the external IR is active. A NAM amp capture is not an impulse response and cannot be loaded into the IR Loader. More advanced multi-plugin NAM/AmpliTube routing is still possible, but it is no longer what `hybrid` means by default.

## Example requests

- “Find a tight 5150-style TONE3000 amp capture and pair it with a cabinet IR.”
- “Give me a TONE3000-only, AmpliTube-only, and hybrid version of this tone.”
- “Choose the best TONE3000 captures, then create a mono preset I can load in the plugin.”
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
| `recommend_tone_chain` | Choose a primary delivery workflow and return the relevant TONE3000, AmpliTube, and hybrid approaches. |
| `create_tone3000_plugin_preset` | Compile exact selected tone/model IDs into a verified `.t3kpreset` using the attributed external builder. |
| `troubleshoot_tone` | Give prioritized changes for common tone problems. |
| `compare_tones` | Compare capture requirements, gain/EQ clues, flexibility, and likely uses. |
| `get_user_tone_profile` | Read an optional local rig profile. |
| `save_user_tone_profile` | Replace an optional local rig profile. |

Every tool has Zod input/output schemas and MCP annotations. The schemas describe the tool contract; the current TONE3000 client does not yet perform full runtime validation of every upstream response.

## Requirements

- Node.js 20 or newer.
- npm.
- Git with submodule support.
- Python 3.8 or newer for native TONE3000 preset compilation.
- A compatible MCP client.
- A TONE3000 account and secret key for live TONE3000 tools.
- A NAM-compatible player and DAW/plugin host to use downloaded NAM models.
- AmpliTube 5 MAX only if you want to build the suggested AmpliTube chains.

Local AmpliTube search, recommendations, and troubleshooting can work without a TONE3000 credential. Live TONE3000 tools will return a configuration error, and recommendations will state that live candidates are unavailable.

## Install and verify

```powershell
git submodule update --init --recursive
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

If the submodule is missing, discovery and recommendation tools still build, but `create_tone3000_plugin_preset` returns a setup error until the builder is initialized.

## Native TONE3000 preset delivery

`create_tone3000_plugin_preset` is intentionally a write tool: it creates a recipe and one or more preset artifacts under `.cache/generated-presets`. Discovery, recommendation, comparison, and troubleshooting tools remain read-only.

The tool accepts exact tone IDs and optional model-name regular expressions. It delegates compilation to the pinned external builder, checks the `T3KB` file signature, runs the builder's verifier, and only then returns the artifact. The current TONE3000 server credential is passed through the child process environment and is never placed on the command line or in tool output.

Presentation depends on the MCP transport:

- **Stdio:** the tool returns the absolute local path to each `.t3kpreset` file.
- **HTTP:** it also returns a link such as `http://127.0.0.1:8787/presets/{artifactId}/{fileName}`. That link is available only while the local HTTP server is running and only from the same computer by default.

The output folder can be changed with `PRESET_OUTPUT_PATH`. The server creates files but does not copy them into the TONE3000 plugin's preset directory or open the plugin.

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

The endpoint is `http://127.0.0.1:8787/mcp`, and `GET /` returns a credential-safe health response. It can be inspected locally with:

```powershell
npx @modelcontextprotocol/inspector@latest
```

Select Streamable HTTP and enter `http://127.0.0.1:8787/mcp`.

> [!WARNING]
> The HTTP implementation binds to `127.0.0.1` by default and does not emit a wildcard CORS origin. It still has no MCP caller authentication and exposes local profile and preset-creation tools. Do not change `HOST`, expose it with a tunnel or port forwarding, or deploy it publicly without adding authentication and authorization.

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

## Preset Builder credit and update model

Native `.t3kpreset` compilation is powered by [TONE3000 Preset Builder](https://github.com/tlennon-ie/Tone3000-PresetBuilder), created by **Thomas Lennon** and licensed under the MIT License. It is included as a Git submodule at `vendor/tone3000-preset-builder`, currently pinned to commit `0862e02f772657e4203d3f98164d851dc0ff63a0`. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and the builder's own license file for the full notice.

No compiler source was copied into this project. `src/preset-builder/client.ts` is a narrow adapter around the builder's public command-line interface. This separation means upstream fixes can be adopted by changing the Git submodule reference instead of copying files:

```powershell
git -C vendor/tone3000-preset-builder fetch origin
git -C vendor/tone3000-preset-builder checkout <reviewed-commit-or-tag>
git add vendor/tone3000-preset-builder
npm run build
npm test
```

Review upstream changes and test generated files before advancing the pin. Consumers receive the reviewed version with `git submodule update --init --recursive`; they do not silently track the builder's latest branch.

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
src/preset-builder/             Adapter and types for the external preset compiler
src/profile/                    Local profile storage
src/data/amplitube5max.json     19-record runtime starter catalog
tests/                          Automated unit tests
docs/research/                  Catalog research and repository review notes
vendor/tone3000-preset-builder/ Pinned external compiler Git submodule
```

The service is intentionally modular: TONE3000 access is isolated from the recommendation engine, and another gear platform can be added alongside `src/amplitube`.

## Current limitations and roadmap

The main work required before a public release is:

1. Add MCP caller authentication and authorization for non-local use.
2. Implement TONE3000 per-user OAuth/Select rather than sharing one server credential.
3. Validate all upstream API responses before caching or processing them.
4. Make profile storage safe for reserved IDs and concurrent writes.
5. Integrate a complete, versioned AmpliTube 5 MAX v2 catalog with microphones and aliases.
6. Generate settings from each model's real control names and ranges.
7. Make saved profiles influence recommendations automatically.
8. Add DAW- and NAM-player-aware routing instructions.
9. Add an explicit preview/confirmation step that converts a recommendation into a preset recipe automatically.
10. Add HTTP, malformed-response, profile-concurrency, and full-catalog tests.

For detailed review evidence, see [`docs/research/code-review-2026-09-07.md`](docs/research/code-review-2026-09-07.md).

## Status

This repository is suitable for local experimentation and MCP development. It is not currently suitable for anonymous public hosting, multi-user profile storage, or authoritative coverage of the full AmpliTube 5 MAX v2 product catalog.
