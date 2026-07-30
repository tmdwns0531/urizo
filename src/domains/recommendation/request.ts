import type {
  DemoScenario,
  RecommendationRequest,
} from "../../contracts/recommendation";
import type { SearchInput } from "../../contracts/search";
import type { UserContext } from "../../contracts/user";

export interface ResolvedRecommendationRequest extends RecommendationRequest {
  userId: string;
  scenario: DemoScenario;
  choice: Required<
    Omit<
      NonNullable<RecommendationRequest["choice"]>,
      "maxRuntimeMinutes"
    >
  > & {
    maxRuntimeMinutes: number | null;
  };
}

export function resolveRecommendationRequest(
  request: RecommendationRequest,
  userId: string,
): ResolvedRecommendationRequest {
  const desiredGenres = request.choice?.desiredGenres ?? [];
  const scenario = request.scenario ?? "normal";
  return {
    userId,
    scenario,
    choice: {
      companions: request.choice?.companions ?? ["ALONE"],
      moods: request.choice?.moods ?? ["따뜻한"],
      desiredGenres,
      companionAvoidGenres:
        request.choice?.companionAvoidGenres ?? [],
      maxRuntimeMinutes:
        scenario === "approval"
          ? 30
          : request.choice?.maxRuntimeMinutes === undefined
            ? 120
            : request.choice.maxRuntimeMinutes,
      originPreference: request.choice?.originPreference ?? "ANY",
      naturalLanguage: request.choice?.naturalLanguage ?? "",
      explicitlyRequestedGenres:
        request.choice?.explicitlyRequestedGenres ?? desiredGenres,
    },
  };
}

export function toSearchInput(
  request: ResolvedRecommendationRequest,
  user: UserContext,
): SearchInput {
  return {
    user,
    companions: request.choice.companions,
    moods: request.choice.moods,
    desiredGenres: request.choice.desiredGenres,
    companionAvoidGenres: request.choice.companionAvoidGenres,
    maxRuntimeMinutes: request.choice.maxRuntimeMinutes,
    originPreference: request.choice.originPreference,
    naturalLanguage: request.choice.naturalLanguage,
    explicitlyRequestedGenres:
      request.choice.explicitlyRequestedGenres,
  };
}
