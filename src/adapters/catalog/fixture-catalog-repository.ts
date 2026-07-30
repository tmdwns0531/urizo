import type { CatalogContent } from "../../contracts/catalog";
import type { CatalogRepository } from "../../contracts/ports";
import { DEMO_CATALOG } from "../../demo/fixtures/catalog";

export class FixtureCatalogRepository implements CatalogRepository {
  async list(): Promise<CatalogContent[]> {
    return DEMO_CATALOG.map((content) => ({
      ...content,
      genres: [...content.genres],
      moodTags: [...content.moodTags],
      companionTags: [...content.companionTags],
      originCountries: [...content.originCountries],
      productionCountries: [...content.productionCountries],
      providers: content.providers.map((provider) => ({ ...provider })),
    }));
  }

  async getById(contentId: string): Promise<CatalogContent | null> {
    const content = DEMO_CATALOG.find((item) => item.id === contentId);
    if (!content) {
      return null;
    }
    return {
      ...content,
      genres: [...content.genres],
      moodTags: [...content.moodTags],
      companionTags: [...content.companionTags],
      originCountries: [...content.originCountries],
      productionCountries: [...content.productionCountries],
      providers: content.providers.map((provider) => ({ ...provider })),
    };
  }
}
