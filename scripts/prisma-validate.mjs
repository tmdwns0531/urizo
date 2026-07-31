import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

// `prisma validate` parses configuration but never connects to PostgreSQL.
// Use loopback port 1 so this child process cannot accidentally target a real
// database even when the parent shell contains database credentials.
const validationOnlyUrl =
  "postgresql://validation:validation@127.0.0.1:1/validation" +
  "?schema=validation_only&connect_timeout=1";

const result = spawnSync(
  process.execPath,
  [
    prismaCli,
    "validate",
    "--schema",
    "prisma/schema.prisma",
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: validationOnlyUrl,
      DIRECT_URL: validationOnlyUrl,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
