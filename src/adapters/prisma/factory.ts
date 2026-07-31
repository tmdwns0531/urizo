import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma-workerd/client";
import {
  PrismaCatalogRepository,
  type PrismaCatalogClient,
} from "../catalog/prisma-catalog-repository";
import {
  PrismaContentEmbeddingRepository,
  type PrismaVectorSqlClient,
} from "./prisma-embedding-repository";
import { PrismaRecommendationPersistenceUnitOfWork } from "./prisma-recommendation-persistence";
import { PrismaRecommendationRunRepository } from "./prisma-run-repository";
import { PrismaAgentTraceRepository } from "./prisma-trace-repository";
import type { PrismaPersistenceClient } from "./types";

export type PrismaLiveClient =
  & PrismaPersistenceClient
  & PrismaCatalogClient
  & PrismaVectorSqlClient
  & {
    $disconnect(): Promise<void>;
  };

export interface PrismaLiveAdapterBundle {
  client: PrismaLiveClient;
  runs: PrismaRecommendationRunRepository;
  traces: PrismaAgentTraceRepository;
  catalog: PrismaCatalogRepository;
  embeddings: PrismaContentEmbeddingRepository;
  persistence: PrismaRecommendationPersistenceUnitOfWork;
  disconnect(): Promise<void>;
}

export function createPrismaLiveAdaptersWithClient(
  client: PrismaLiveClient,
): PrismaLiveAdapterBundle {
  return {
    client,
    runs: new PrismaRecommendationRunRepository(client),
    traces: new PrismaAgentTraceRepository(client),
    catalog: new PrismaCatalogRepository(client),
    embeddings: new PrismaContentEmbeddingRepository(client),
    persistence: new PrismaRecommendationPersistenceUnitOfWork(client),
    disconnect: () => client.$disconnect(),
  };
}

/**
 * Workerd-compatible Prisma factory. Composition must dynamically import this
 * module only after a Prisma-backed capability has been selected and the
 * caller has validated the connection string. The factory reads no global or
 * process environment and creates no cross-request/global cache.
 */
export function createPrismaLiveAdapters(
  connectionString: string,
): PrismaLiveAdapterBundle {
  if (
    typeof connectionString !== "string" ||
    !connectionString.trim()
  ) {
    throw new Error("PRISMA_CONNECTION_STRING_REQUIRED");
  }
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter }) as unknown as PrismaLiveClient;
  return createPrismaLiveAdaptersWithClient(client);
}
