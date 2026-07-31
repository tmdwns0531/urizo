import type {
  AgeRating,
  CatalogContent,
  MediaType,
  OttProvider,
  ProviderAvailability,
  ProviderLinkType,
} from "../../contracts/catalog";
import type { CatalogRepository } from "../../contracts/ports";
import {
  PrismaRepositoryError,
} from "../prisma/types";

export interface PrismaProviderAvailabilityRecord {
  provider: OttProvider;
  watchUrl: string;
  linkType: ProviderLinkType;
}

type PrismaCatalogAgeRating =
  | "ALL"
  | "SEVEN"
  | "TWELVE"
  | "FIFTEEN"
  | "EIGHTEEN"
  | "UNKNOWN";

export interface PrismaCatalogContentRecord {
  id: string;
  tmdbId: number;
  title: string;
  synopsis: string;
  mediaType: MediaType;
  runtimeMinutes: number;
  releaseYear: number;
  genres: string[];
  moodTags: string[];
  companionTags: string[];
  ageRating: PrismaCatalogAgeRating;
  originCountries: string[];
  productionCountries: string[];
  collectionId: string | null;
  voteAverage: number;
  voteCount: number;
  posterUrl: string | null;
  backdropColor: string;
  isActive: boolean;
  providers: PrismaProviderAvailabilityRecord[];
}

interface PrismaCatalogContentDelegate {
  findMany(args: {
    where: { isActive: true };
    include: {
      providers: {
        orderBy: { provider: "asc" };
      };
    };
    orderBy: [
      { voteCount: "desc" },
      { id: "asc" },
    ];
  }): Promise<PrismaCatalogContentRecord[]>;
  findUnique(args: {
    where:
      | { id: string }
      | {
          tmdbId_mediaType: {
            tmdbId: number;
            mediaType: MediaType;
          };
        };
    include: {
      providers: {
        orderBy: { provider: "asc" };
      };
    };
  }): Promise<PrismaCatalogContentRecord | null>;
  updateMany(args: {
    where: { id: string; isActive?: true };
    data: { isActive: false };
  }): Promise<{ count: number }>;
  upsert(args: {
    where: {
      tmdbId_mediaType: {
        tmdbId: number;
        mediaType: MediaType;
      };
    };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
    include: {
      providers: {
        orderBy: { provider: "asc" };
      };
    };
  }): Promise<PrismaCatalogContentRecord>;
}

interface PrismaSearchDocumentDelegate {
  updateMany(args: {
    where: {
      contentId: string;
      isActive: true;
      NOT?: { contentHash: string };
    };
    data: { isActive: false };
  }): Promise<{ count: number }>;
  upsert(args: {
    where: {
      contentId_contentHash: {
        contentId: string;
        contentHash: string;
      };
    };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface PrismaCatalogTransaction {
  catalogContent: PrismaCatalogContentDelegate;
  contentSearchDocument: PrismaSearchDocumentDelegate;
}

export interface PrismaCatalogClient extends PrismaCatalogTransaction {
  $transaction<T>(
    operation: (transaction: PrismaCatalogTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface CatalogSearchDocumentInput {
  id: string;
  locale: string;
  documentText: string;
  contentHash: string;
}

export interface CatalogUpsertInput {
  content: CatalogContent;
  searchDocument: CatalogSearchDocumentInput;
}

function mapProvider(
  provider: PrismaProviderAvailabilityRecord,
): ProviderAvailability {
  return {
    provider: provider.provider,
    watchUrl: provider.watchUrl,
    linkType: provider.linkType,
  };
}

function mapAgeRatingFromPrisma(
  rating: PrismaCatalogAgeRating,
): AgeRating {
  const ratings: Record<PrismaCatalogAgeRating, AgeRating> = {
    ALL: "ALL",
    SEVEN: "7",
    TWELVE: "12",
    FIFTEEN: "15",
    EIGHTEEN: "18",
    UNKNOWN: "UNKNOWN",
  };
  return ratings[rating];
}

function mapAgeRatingToPrisma(
  rating: AgeRating,
): PrismaCatalogAgeRating {
  const ratings: Record<AgeRating, PrismaCatalogAgeRating> = {
    ALL: "ALL",
    "7": "SEVEN",
    "12": "TWELVE",
    "15": "FIFTEEN",
    "18": "EIGHTEEN",
    UNKNOWN: "UNKNOWN",
  };
  return ratings[rating];
}
export function mapPrismaCatalogContent(
  record: PrismaCatalogContentRecord,
): CatalogContent {
  return {
    id: record.id,
    tmdbId: record.tmdbId,
    title: record.title,
    synopsis: record.synopsis,
    mediaType: record.mediaType,
    runtimeMinutes: record.runtimeMinutes,
    releaseYear: record.releaseYear,
    genres: [...record.genres],
    moodTags: [...record.moodTags],
    companionTags: [...record.companionTags],
    ageRating: mapAgeRatingFromPrisma(record.ageRating),
    originCountries: [...record.originCountries],
    productionCountries: [...record.productionCountries],
    providers: record.providers.map(mapProvider),
    collectionId: record.collectionId,
    voteAverage: record.voteAverage,
    voteCount: record.voteCount,
    posterUrl: record.posterUrl,
    backdropColor: record.backdropColor,
  };
}

function assertCatalogUpsertInput(input: CatalogUpsertInput): void {
  const { content, searchDocument } = input;
  if (!content.id || content.id.length > 64) {
    throw new PrismaRepositoryError("CATALOG_WRITE_FAILED");
  }
  if (
    !Number.isInteger(content.runtimeMinutes) ||
    content.runtimeMinutes <= 0 ||
    !Number.isInteger(content.releaseYear) ||
    content.releaseYear < 1870 ||
    content.releaseYear > 2200
  ) {
    throw new PrismaRepositoryError("CATALOG_WRITE_FAILED");
  }
  if (
    !/^[0-9a-f]{64}$/.test(searchDocument.contentHash) ||
    !searchDocument.id ||
    searchDocument.id.length > 64 ||
    !searchDocument.documentText.trim()
  ) {
    throw new PrismaRepositoryError("CATALOG_WRITE_FAILED");
  }
  for (const provider of content.providers) {
    try {
      const url = new URL(provider.watchUrl);
      if (url.protocol !== "https:") {
        throw new Error("non-HTTPS provider link");
      }
    } catch {
      throw new PrismaRepositoryError("CATALOG_WRITE_FAILED");
    }
  }
}

function catalogWriteData(
  content: CatalogContent,
): Record<string, unknown> {
  return {
    id: content.id,
    tmdbId: content.tmdbId,
    title: content.title,
    synopsis: content.synopsis,
    mediaType: content.mediaType,
    runtimeMinutes: content.runtimeMinutes,
    releaseYear: content.releaseYear,
    genres: [...content.genres],
    moodTags: [...content.moodTags],
    companionTags: [...content.companionTags],
    ageRating: mapAgeRatingToPrisma(content.ageRating),
    originCountries: [...content.originCountries],
    productionCountries: [...content.productionCountries],
    collectionId: content.collectionId,
    voteAverage: content.voteAverage,
    voteCount: content.voteCount,
    posterUrl: content.posterUrl,
    backdropColor: content.backdropColor,
    isActive: true,
  };
}

function providerCreateData(
  providers: readonly ProviderAvailability[],
): Array<Record<string, unknown>> {
  return providers.map((provider) => ({
    provider: provider.provider,
    watchUrl: provider.watchUrl,
    linkType: provider.linkType,
  }));
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly client: PrismaCatalogClient) {}

  async list(): Promise<CatalogContent[]> {
    const records = await this.client.catalogContent.findMany({
      where: { isActive: true },
      include: {
        providers: {
          orderBy: { provider: "asc" },
        },
      },
      orderBy: [
        { voteCount: "desc" },
        { id: "asc" },
      ],
    });
    return records.map(mapPrismaCatalogContent);
  }

  async getById(contentId: string): Promise<CatalogContent | null> {
    const record = await this.client.catalogContent.findUnique({
      where: { id: contentId },
      include: {
        providers: {
          orderBy: { provider: "asc" },
        },
      },
    });
    return record && record.isActive
      ? mapPrismaCatalogContent(record)
      : null;
  }

  /**
   * Fail-closed ingestion path. Once TMDB can no longer prove the minimum
   * runtime/provider facts, both the runtime row and every current search
   * document are hidden atomically. Historical rows remain available for
   * audit/rebuild and can be reactivated by a later valid upsert.
   */
  async deactivateCatalog(
    tmdbId: number,
    mediaType: MediaType,
  ): Promise<boolean> {
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      throw new PrismaRepositoryError("CATALOG_WRITE_FAILED");
    }

    return this.client.$transaction(async (transaction) => {
      const stored = await transaction.catalogContent.findUnique({
        where: {
          tmdbId_mediaType: {
            tmdbId,
            mediaType,
          },
        },
        include: {
          providers: {
            orderBy: { provider: "asc" },
          },
        },
      });
      if (!stored) {
        return false;
      }

      const result = await transaction.catalogContent.updateMany({
        where: {
          id: stored.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
      await transaction.contentSearchDocument.updateMany({
        where: {
          contentId: stored.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
      return result.count > 0;
    });
  }

  async upsertCatalog(
    input: CatalogUpsertInput,
  ): Promise<CatalogContent> {
    assertCatalogUpsertInput(input);
    const baseData = catalogWriteData(input.content);
    const providers = providerCreateData(input.content.providers);

    return this.client.$transaction(async (transaction) => {
      const stored = await transaction.catalogContent.upsert({
        where: {
          tmdbId_mediaType: {
            tmdbId: input.content.tmdbId,
            mediaType: input.content.mediaType,
          },
        },
        create: {
          ...baseData,
          providers: {
            create: providers,
          },
        },
        update: {
          ...baseData,
          id: undefined,
          providers: {
            deleteMany: {},
            create: providers,
          },
        },
        include: {
          providers: {
            orderBy: { provider: "asc" },
          },
        },
      });

      await transaction.contentSearchDocument.updateMany({
        where: {
          contentId: stored.id,
          isActive: true,
          NOT: {
            contentHash: input.searchDocument.contentHash,
          },
        },
        data: {
          isActive: false,
        },
      });
      await transaction.contentSearchDocument.upsert({
        where: {
          contentId_contentHash: {
            contentId: stored.id,
            contentHash: input.searchDocument.contentHash,
          },
        },
        create: {
          id: input.searchDocument.id,
          contentId: stored.id,
          locale: input.searchDocument.locale,
          documentText: input.searchDocument.documentText,
          contentHash: input.searchDocument.contentHash,
          isActive: true,
        },
        update: {
          locale: input.searchDocument.locale,
          documentText: input.searchDocument.documentText,
          isActive: true,
        },
      });

      return mapPrismaCatalogContent(stored);
    });
  }
}
