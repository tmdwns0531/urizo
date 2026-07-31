import { FixtureCatalogRepository } from "../adapters/catalog/fixture-catalog-repository";
import { MemoryRecommendationPersistenceUnitOfWork } from "../adapters/memory/memory-recommendation-persistence";
import { MemoryRunRepository } from "../adapters/memory/memory-run-repository";
import { MemoryTraceRepository } from "../adapters/memory/memory-trace-repository";
import { DeterministicSelectorAdapter } from "../adapters/recommendation/deterministic-selector-adapter";
import { LocalSearchAdapter } from "../adapters/search/local-search-adapter";
import type { MvpAdapterSet } from "./types";

export interface DemoAdapterSet extends MvpAdapterSet {
  runs: MemoryRunRepository;
  traces: MemoryTraceRepository;
  persistence: MemoryRecommendationPersistenceUnitOfWork;
}

export function createDemoAdapters(): DemoAdapterSet {
  const runs = new MemoryRunRepository();
  const traces = new MemoryTraceRepository();
  return {
    catalog: new FixtureCatalogRepository(),
    search: new LocalSearchAdapter(),
    selector: new DeterministicSelectorAdapter(),
    runs,
    traces,
    persistence: new MemoryRecommendationPersistenceUnitOfWork(runs, traces),
  };
}