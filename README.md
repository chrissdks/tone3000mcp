# Guitar Tone Assistant

Guitar Tone Assistant is a TypeScript MCP server for finding TONE3000 captures and designing practical rigs with AmpliTube 5 MAX. It exposes both a local stdio server and a stateless Streamable HTTP endpoint for ChatGPT/Codex-compatible MCP clients.

The server understands the routing distinction that matters most:

- `amp` NAM capture: amp-head snapshot; add a cabinet or IR afterward.
- `amp-cab` NAM capture: cabinet coloration is already captured; do not add another cab by default.
- `ir`/cabinet result: use after an amp-head capture or full amp simulation.
- NAM captures are fixed snapshots of a rig. AmpliTube amp models expose continuously adjustable controls.

Artist references are treated as approximations and useful starting points, not promises of an exact recorded tone.

## Included tools

| Tool | Purpose |
| --- | --- |
| `search_tone3000` | Search and rank live TONE3000 tone packs with direct page links. |
| `get_tone3000_tone` | Resolve an ID/URL, classify the capture, and list model metadata/download URLs. |
| `search_tone3000_cabs` | Find cabinet IRs by speaker, size, and character. |
| `search_amplitube_gear` | Search the curated local AmpliTube 5 MAX starter catalog. |
| `recommend_tone_chain` | Return TONE3000-focused, AmpliTube-only, and hybrid approaches. |
| `troubleshoot_tone` | Give prioritized exact changes for fizz, mud, harshness, boom, thinness, compression, or attack. |
| `compare_tones` | Compare capture requirements, gain/EQ clues, flexibility, and use cases. |
| `get_user_tone_profile` | Read an optional local rig profile. |
| `save_user_tone_profile` | Replace an optional local rig profile. |

Every tool has Zod input/output schemas and MCP safety annotations.

## Verified API behavior

Verified against the official documentation on 2026-09-05:

- TONE3000 API v1 base: `https://www.tone3000.com/api/v1`.
- Authentication supports a server-only secret key and user-facing OAuth 2.0 with PKCE.
- Search: `GET /tones/search`; detail: `GET /tones/{id}`; models: `GET /models?tone_id={id}`.
- Tone objects expose `url`, so this project returns the API-provided direct page URL rather than guessing a route.
- Model `model_url` values require the Bearer credential when downloading.
- Default rate limit is 100 requests/minute. Search is more heavily limited, and TONE3000 recommends its Select OAuth flow for browsing.
- A whole-tone ZIP download is partner-only; this project uses model listing instead.

References: [TONE3000 API](https://www.tone3000.com/api), [OpenAI MCP server guide](https://developers.openai.com/plugins/build/mcp-server), [OpenAI app quickstart](https://developers.openai.com/plugins/build/app-quickstart), [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp), and [IK Multimedia AmpliTube 5](https://www.ikmultimedia.com/products/amplitube5/).

## Setup

Requirements: Node.js 20 or newer and a TONE3000 account.

```powershell
npm install
Copy-Item .env.example .env
```

Open [TONE3000 settings](https://www.tone3000.com/settings), generate API credentials, and put the **secret key** in `.env`:

```dotenv
TONE3000_SECRET_KEY=t3k_cs_replace_me
```

Never put this server credential in browser code, a public repository, tool output, or logs. The publishable `client_id` is for OAuth flows and is not a substitute for the secret key in this server-side configuration.

Then build and test:

```powershell
npm run build
npm test
```

## Run locally

Stdio (best for a local Codex client):

```powershell
npm run build
node dist/src/index.js
```

Streamable HTTP:

```powershell
npm run build
node dist/src/http.js
```

The HTTP MCP URL is `http://localhost:8787/mcp`. `GET /` is a credential-safe health response.

To inspect the HTTP server:

```powershell
npx @modelcontextprotocol/inspector@latest
```

Select Streamable HTTP and enter `http://localhost:8787/mcp`.

## Connect to Codex

The official Codex configuration supports both stdio and Streamable HTTP. For this repository's local stdio build:

```powershell
codex mcp add guitar-tone-assistant --env TONE3000_SECRET_KEY=t3k_cs_replace_me -- node C:\absolute\path\to\Tone3000mcp\dist\src\index.js
```

Alternatively, add project-scoped `.codex/config.toml` (only for a trusted project):

```toml
[mcp_servers.guitar-tone-assistant]
command = "node"
args = ["C:/absolute/path/to/Tone3000mcp/dist/src/index.js"]
cwd = "C:/absolute/path/to/Tone3000mcp"
env_vars = ["TONE3000_SECRET_KEY"]
```

Run `codex mcp list` or use `/mcp` to verify the connection. Do not commit a secret in `config.toml`; forward it from your environment.

## Connect to ChatGPT

For the ChatGPT web plugin flow, run the HTTP server and expose it at a public HTTPS URL (for example via a development tunnel). Use the complete `https://…/mcp` URL when creating the plugin connection. Current official steps are Settings → Security and login → enable Developer mode, then ChatGPT Plugins → plus button → create a connection.

This MVP is intentionally server-credential based. Before sharing it with multiple users or publishing it, add MCP-user authentication and broker TONE3000's per-user OAuth 2.0 + PKCE flow. Do not deploy one personal TONE3000 secret as a public anonymous endpoint.

## Example calls and output shapes

Natural-language prompts:

- “Find me a Metallica Black Album rhythm tone.”
- “Give me a Jerry Cantrell Dirt-era tone.”
- “Find a tight 5150-style TONE3000 capture and pair it with a good cab IR.”
- “I have a Les Paul with humbuckers. Help me make this tone less fizzy.”
- “Give me a TONE3000-only setup, an AmpliTube-only setup, and a hybrid setup.”
- “Give me a clean Fender-style tone.”

Representative `recommend_tone_chain` arguments:

```json
{
  "target": "modern 5150 metal tone",
  "guitarType": "Les Paul",
  "pickupType": "humbuckers",
  "tuning": "Drop C"
}
```

Representative structured result (abbreviated):

```json
{
  "target": "modern 5150 metal tone",
  "interpretation": "Modern 5150-family metal…",
  "preferredWorkflow": null,
  "approaches": [
    {
      "workflow": "tone3000",
      "signalChain": ["Input", "Noise Gate", "TONE3000 amp-head", "Cab/IR", "Post EQ"],
      "tone3000Models": [{ "id": 123, "directUrl": "https://www.tone3000.com/…" }],
      "settings": { "gain": 4, "bass": 3.5, "mid": 5, "treble": 5.5, "presence": 4.5 }
    }
  ],
  "caveats": ["All values are starting points…"],
  "tone3000Status": "Found 4 ranked TONE3000 candidates."
}
```

If no credential is configured, local AmpliTube search, recommendations, and troubleshooting still work. Live TONE3000 tools return a clear configuration error; recommendation results state that live candidates are unavailable without inventing links or metadata.

## Data and extension points

The starter gear database is [src/data/amplitube5max.json](src/data/amplitube5max.json). It is deliberately small and includes mapping confidence plus an official source URL for each entry. `not-stated` and `inferred` mappings are not exact product claims.

Add another platform by creating a new module parallel to `src/amplitube`, then adapt it into the recommendation layer. TONE3000 access remains isolated in `src/tone3000`; no site scraping is used.

## Production limitations

- TONE3000's search endpoint is heavily rate-limited. The in-memory TTL cache reduces duplicate reads, but production catalog browsing should use the Select OAuth flow and coordinate access with TONE3000.
- TONE3000 API v1 may change. The client is isolated so response validation and endpoint changes remain localized.
- The current profile store is local JSON and suitable for one trusted local server, not multi-tenant hosting.
- Review TONE3000's API Terms, Design Requirements, and Commercial Terms. Commercial products require an agreement and review; non-commercial integrations have endpoint restrictions described in the official docs.
- The bundled AmpliTube catalog is a curated starter set, not all 435 items currently listed for MAX v2.
