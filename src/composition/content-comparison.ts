import type { CatalogContent } from "../contracts/catalog";
import { withMvpComposition } from "./index";

/**
 * Comparison deliberately reuses only the selected catalog adapter. It does
 * not call retrieval, selector models, Run/Trace, or a public API.
 */
export async function loadContentComparisonCatalog(): Promise<
  CatalogContent[]
> {
  return withMvpComposition(({ adapters }) => adapters.catalog.list());
}
