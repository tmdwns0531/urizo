import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";
const WORKER_COMPATIBILITY_DATE = "2026-05-22";
const LOCAL_LIVE_OVERRIDE = "live";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

function createLocalBindingConfig(forceLivePreset: boolean) {
  return {
    main: "./worker/index.ts",
    compatibility_date: WORKER_COMPATIBILITY_DATE,
    compatibility_flags: [
      "nodejs_compat",
      "nodejs_compat_populate_process_env",
    ],
    ...(forceLivePreset
      ? {
          vars: {
            // This is a non-secret local mode switch. Secrets continue to be
            // loaded from ignored .env.local by the Cloudflare Vite plugin.
            OTT_DAMOA_PROFILE_OVERRIDE: "live",
          },
        }
      : {}),
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: "site-creator-d1",
            database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          },
        ]
      : [],
    r2_buckets: r2
      ? [
          {
            binding: r2,
            bucket_name: "site-creator-r2",
          },
        ]
      : [],
  };
}

export default defineConfig(async ({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const forceLivePreset =
    command === "serve" &&
    process.env.OTT_DAMOA_PROFILE_OVERRIDE === LOCAL_LIVE_OVERRIDE;

  return {
    resolve: { dedupe: ["react", "react-dom"] },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: createLocalBindingConfig(forceLivePreset),
      }),
    ],
  };
});