import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { Tone3000PresetBuilder } from "./preset-builder/client.js";
import { ProfileStore } from "./profile/store.js";
import { createGuitarToneServer } from "./server.js";
import { Tone3000Client } from "./tone3000/client.js";

const config = loadConfig();
const server = createGuitarToneServer({
  tone3000: new Tone3000Client(config.tone3000),
  profiles: new ProfileStore(config.profileStorePath),
  presetBuilder: new Tone3000PresetBuilder({
    ...config.presetBuilder,
    tone3000SecretKey: config.tone3000.secretKey,
  }),
});

await server.connect(new StdioServerTransport());
