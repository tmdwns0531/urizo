import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

// Client generation parses the datasource but does not connect to it. Keep
// generation credential-free and independent from a developer's .env.local.
const generationOnlyUrl =
  "postgresql://generation:generation@127.0.0.1:1/generation" +
  "?schema=generation_only&connect_timeout=1";

const result = spawnSync(
  process.execPath,
  [
    prismaCli,
    "generate",
    "--schema",
    "prisma/schema.prisma",
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: generationOnlyUrl,
      DIRECT_URL: generationOnlyUrl,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;