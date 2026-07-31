import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma-node/client";
import {
  PrismaCatalogRepository,
  type PrismaCatalogClient,
} from "../catalog/prisma-catalog-repository";
import {
  PrismaContentEmbeddingRepository,
  type PrismaVectorSqlClient,
} from "./prisma-embedding-repository";

export type PrismaBatchClient =
  & PrismaCatalogClient
  & PrismaVectorSqlClient
  & {
    $disconnect(): Promise<void>;
  };

export interface PrismaBatchAdapterBundle {
  client: PrismaBatchClient;
  catalog: PrismaCatalogRepository;
  embeddings: PrismaContentEmbeddingRepository;
  disconnect(): Promise<void>;
}

/** Node-only operator factory for migration-adjacent ingestion and embedding. */
export function createPrismaBatchAdapters(
  connectionString: string,
): PrismaBatchAdapterBundle {
  if (!connectionString.trim()) {
    throw new Error("PRISMA_CONNECTION_STRING_REQUIRED");
  }
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter }) as unknown as PrismaBatchClient;
  return {
    client,
    catalog: new PrismaCatalogRepository(client),
    embeddings: new PrismaContentEmbeddingRepository(client),
    disconnect: () => client.$disconnect(),
  };
}