import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vinextCli = fileURLToPath(
  new URL("./cli.js", import.meta.resolve("vinext")),
);

const result = spawnSync(
  process.execPath,
  [vinextCli, "dev", ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      OTT_DAMOA_PROFILE_OVERRIDE: "live",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
