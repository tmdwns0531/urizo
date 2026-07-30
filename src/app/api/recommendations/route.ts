import { services } from "@/composition";
import {
  DEMO_SCENARIOS,
  type RecommendationChoice,
  type RecommendationRequest,
} from "@/contracts/recommendation";
import {
  COMPANIONS,
  ORIGIN_PREFERENCES,
} from "@/contracts/search";
import {
  badRequest,
  enumArray,
  enumValue,
  errorResponse,
  isRecord,
  optionalString,
  readJsonObject,
  stringArray,
} from "../_shared/http";

function recommendationChoice(
  value: unknown,
): RecommendationChoice | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw badRequest("choice 값은 JSON 객체여야 합니다.");
  }

  const choice: RecommendationChoice = {};
  if (value.companions !== undefined) {
    choice.companions = enumArray(
      value.companions,
      "choice.companions",
      COMPANIONS,
      { allowEmpty: false },
    );
  }
  if (value.moods !== undefined) {
    choice.moods = stringArray(value.moods, "choice.moods");
  }
  if (value.desiredGenres !== undefined) {
    choice.desiredGenres = stringArray(
      value.desiredGenres,
      "choice.desiredGenres",
    );
  }
  if (value.companionAvoidGenres !== undefined) {
    choice.companionAvoidGenres = stringArray(
      value.companionAvoidGenres,
      "choice.companionAvoidGenres",
    );
  }
  if (value.maxRuntimeMinutes !== undefined) {
    if (value.maxRuntimeMinutes === null) {
      choice.maxRuntimeMinutes = null;
    } else if (
      typeof value.maxRuntimeMinutes === "number" &&
      Number.isInteger(value.maxRuntimeMinutes) &&
      value.maxRuntimeMinutes > 0 &&
      value.maxRuntimeMinutes <= 600
    ) {
      choice.maxRuntimeMinutes = value.maxRuntimeMinutes;
    } else {
      throw badRequest(
        "choice.maxRuntimeMinutes 값은 1~600 사이의 정수 또는 null이어야 합니다.",
      );
    }
  }
  if (value.originPreference !== undefined) {
    choice.originPreference = enumValue(
      value.originPreference,
      "choice.originPreference",
      ORIGIN_PREFERENCES,
    );
  }
  if (value.naturalLanguage !== undefined) {
    if (value.naturalLanguage === "") {
      choice.naturalLanguage = "";
    } else {
      choice.naturalLanguage = optionalString(
        value.naturalLanguage,
        "choice.naturalLanguage",
        500,
      );
    }
  }
  if (value.explicitlyRequestedGenres !== undefined) {
    choice.explicitlyRequestedGenres = stringArray(
      value.explicitlyRequestedGenres,
      "choice.explicitlyRequestedGenres",
    );
  }
  return choice;
}

function recommendationRequest(
  body: Record<string, unknown>,
): RecommendationRequest {
  const request: RecommendationRequest = {};
  if (body.scenario !== undefined) {
    request.scenario = enumValue(
      body.scenario,
      "scenario",
      DEMO_SCENARIOS,
    );
  }
  const choice = recommendationChoice(body.choice);
  if (choice !== undefined) {
    request.choice = choice;
  }
  return request;
}

export async function GET(): Promise<Response> {
  try {
    const runs = await services.listRuns();
    return Response.json({ runs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    return Response.json(
      await services.recommend(recommendationRequest(body)),
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Unknown demo user")
    ) {
      return errorResponse(badRequest("요청한 Demo 사용자를 찾을 수 없습니다."));
    }
    return errorResponse(error);
  }
}
