import { withMvpComposition } from "@/composition";
import {
  AD_PLACEMENTS,
  type AdPlacement,
  type AdSelectionResponse,
  type AnonymousAdContext,
} from "@/contracts/advertising";
import { OTT_PROVIDERS, type OttProvider } from "@/contracts/catalog";
import {
  COMPANIONS,
  MVP_MOODS,
  type Companion,
  type Mood,
} from "@/contracts/mvp-search";
import { selectApprovedCampaign } from "@/domains/advertising/campaign-selector";
import {
  badRequest,
  errorResponse,
  isRecord,
  readJsonObject,
  stringArray,
} from "../_shared/http";

const EMPTY_CONTEXT: AnonymousAdContext = {
  selectedProviders: [],
  companions: [],
  moods: [],
  desiredGenres: [],
};

function enumArray<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T[] {
  const values = stringArray(value, field, { maximumItems: 20 });
  if (values.some((item) => !allowed.includes(item as T))) {
    throw badRequest(`${field} 값에 지원하지 않는 항목이 있습니다.`);
  }
  return values as T[];
}

function parsePlacement(value: unknown): AdPlacement {
  if (
    typeof value !== "string" ||
    !AD_PLACEMENTS.includes(value as AdPlacement)
  ) {
    throw badRequest("placement 값이 올바르지 않습니다.");
  }
  return value as AdPlacement;
}

function parseContext(value: unknown): AnonymousAdContext {
  if (value === undefined) return EMPTY_CONTEXT;
  if (!isRecord(value)) throw badRequest("context 값은 객체여야 합니다.");

  return {
    selectedProviders: enumArray<OttProvider>(
      value.selectedProviders ?? [],
      "context.selectedProviders",
      OTT_PROVIDERS,
    ),
    companions: enumArray<Companion>(
      value.companions ?? [],
      "context.companions",
      COMPANIONS,
    ),
    moods: enumArray<Mood>(
      value.moods ?? [],
      "context.moods",
      MVP_MOODS,
    ),
    desiredGenres: stringArray(
      value.desiredGenres ?? [],
      "context.desiredGenres",
      { maximumItems: 20, maximumItemLength: 40 },
    ),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request, { maximumBytes: 4_096 });
    const placement = parsePlacement(body.placement);
    const runId =
      typeof body.runId === "string" && body.runId.trim()
        ? body.runId.trim().slice(0, 200)
        : undefined;
    let context = parseContext(body.context);

    if (runId) {
      const runContext = await withMvpComposition(async ({ adapters }) => {
        const run = await adapters.runs.get(runId);
        return run?.requestSnapshot ?? null;
      });
      if (runContext) {
        context = {
          selectedProviders: runContext.selectedProviders,
          companions: runContext.companions,
          moods: runContext.moods,
          desiredGenres: runContext.desiredGenres,
        };
      }
    }

    const campaign = selectApprovedCampaign({
      placement,
      context,
      selectionKey:
        runId ??
        JSON.stringify([
          context.selectedProviders,
          context.companions,
          context.moods,
          context.desiredGenres,
        ]),
    });
    const response = { campaign } satisfies AdSelectionResponse;
    return Response.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
