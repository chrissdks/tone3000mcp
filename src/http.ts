import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { ProfileStore } from "./profile/store.js";
import { Tone3000PresetBuilder } from "./preset-builder/client.js";
import { createGuitarToneServer } from "./server.js";
import { Tone3000Client } from "./tone3000/client.js";

const config = loadConfig();
const tone3000 = new Tone3000Client(config.tone3000);
const profiles = new ProfileStore(config.profileStorePath);
const presetBuilder = new Tone3000PresetBuilder({
  ...config.presetBuilder,
  tone3000SecretKey: config.tone3000.secretKey,
  downloadBaseUrl: `http://${config.host}:${config.port}`,
});
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) { res.writeHead(400).end("Missing URL"); return; }
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id, mcp-protocol-version",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ name: "Guitar Tone Assistant", mcp: MCP_PATH, tone3000Configured: tone3000.configured, presetDownloads: "/presets/{artifactId}/{fileName}" }));
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/presets/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 3) { res.writeHead(404).end("Not Found"); return; }
    try {
      const artifactId = parts[1];
      const fileName = decodeURIComponent(parts[2]);
      const filePath = await presetBuilder.resolveDownload(artifactId, fileName);
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      const stream = createReadStream(filePath);
      stream.on("error", () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      stream.pipe(res);
    } catch {
      res.writeHead(404).end("Preset not found");
    }
    return;
  }
  if (url.pathname === MCP_PATH && req.method && new Set(["POST", "GET", "DELETE"]).has(req.method)) {
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = createGuitarToneServer({ tone3000, profiles, presetBuilder });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request failed", error instanceof Error ? error.message : "unknown error");
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }
  res.writeHead(404).end("Not Found");
});

httpServer.listen(config.port, config.host, () => {
  console.log(`Guitar Tone Assistant listening on http://${config.host}:${config.port}${MCP_PATH}`);
});
