import { DemoAuthAdapter } from "../adapters/auth/demo-auth-adapter";
import { FixtureCatalogRepository } from "../adapters/catalog/fixture-catalog-repository";
import { MemoryEngagementRepository } from "../adapters/memory/memory-engagement-repository";
import { MemoryProfileRepository } from "../adapters/memory/memory-profile-repository";
import { MemoryRunRepository } from "../adapters/memory/memory-run-repository";
import { MemoryTraceRepository } from "../adapters/memory/memory-trace-repository";
import { DeterministicSelectorAdapter } from "../adapters/recommendation/deterministic-selector-adapter";
import { LocalSearchAdapter } from "../adapters/search/local-search-adapter";
import type { AdapterSet } from "./types";

export function createDemoAdapters(): AdapterSet {
  const profiles = new MemoryProfileRepository();
  return {
    profiles,
    auth: new DemoAuthAdapter(profiles),
    catalog: new FixtureCatalogRepository(),
    search: new LocalSearchAdapter(),
    selector: new DeterministicSelectorAdapter(),
    runs: new MemoryRunRepository(),
    traces: new MemoryTraceRepository(),
    engagements: new MemoryEngagementRepository(),
  };
}
