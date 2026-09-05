import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ProfileStore } from "./profile/store.js";
import { createGuitarToneServer } from "./server.js";
import { Tone3000Client } from "./tone3000/client.js";

const config = loadConfig();
const server = createGuitarToneServer({
  tone3000: new Tone3000Client(config.tone3000),
  profiles: new ProfileStore(config.profileStorePath),
});

await server.connect(new StdioServerTransport());
