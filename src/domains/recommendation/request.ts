import { OTT_PROVIDERS, type OttProvider } from "../../contracts/catalog";
import type {
  Companion,
  MvpDemoRecommendationRequest,
  MvpDemoScenario,
  MvpRecommendationRequest,
  Mood,
  NaturalLanguage140,
  OriginPreference,
  SanitizedRecommendationSearchInput,
  TransientRecommendationSearchInput,
} from "../../contracts/mvp-search";
import {
  CHOICE_RUNTIME_MINUTES,
  COMPANIONS,
  MVP_DEMO_SCENARIOS,
  MVP_GENRE_MAX_CODE_POINTS,
  MVP_GENRE_MAX_ITEMS,
  MVP_MOODS,
  NATURAL_LANGUAGE_MAX_CODE_POINTS,
  ORIGIN_PREFERENCES,
} from "../../contracts/mvp-search";
import type {
  DemoScenario,
  RecommendationRequest,
} from "../../contracts/recommendation";
import type { SearchInput } from "../../contracts/search";
import type { UserContext } from "../../contracts/user";

export type MvpRequestProfile = "demo" | "live";

export interface MvpRecommendationRequestValidationIssue {
  path: string;
  code:
    | "UNKNOWN_FIELD"
    | "INVALID_TYPE"
    | "INVALID_VALUE"
    | "CARDINALITY"
    | "DUPLICATE"
    | "POLICY";
  message: string;
}

export class MvpRequestValidationError extends Error {
  readonly name = "MvpRequestValidationError";
  readonly code = "BAD_REQUEST" as const;

  constructor(
    readonly issues: readonly MvpRecommendationRequestValidationIssue[],
  ) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
}

/** @deprecated Use MvpRequestValidationError. */
export { MvpRequestValidationError as MvpRecommendationRequestValidationError };

export interface ResolvedMvpRecommendationChoice {
  selectedProviders: OttProvider[];
  companions: Companion[];
  moods: Mood[];
  desiredGenres: string[];
  companionAvoidGenres: string[];
  maxRuntimeMinutes: 30 | 60 | 120 | 180 | null;
  originPreference: OriginPreference;
  naturalLanguage: NaturalLanguage140;
}

export interface ResolvedMvpRecommendationRequest {
  choice: ResolvedMvpRecommendationChoice;
  /** Non-null only for the isolated Demo Lab path; never persist it. */
  scenario: MvpDemoScenario | null;
  transientInput: TransientRecommendationSearchInput;
  sanitizedInput: SanitizedRecommendationSearchInput;
}

export interface ResolveMvpRecommendationRequestOptions {
  profile?: MvpRequestProfile;
  /** Compatibility alias for HTTP composition: false is the safe default. */
  allowScenario?: boolean;
  /** Reject requests that contain only neutral/default CHOICE values. */
  requireMeaningfulChoice?: boolean;
}

const REQUEST_KEYS = ["choice"] as const;
const DEMO_REQUEST_KEYS = ["choice", "scenario"] as const;
const CHOICE_KEYS = [
  "selectedProviders",
  "companions",
  "moods",
  "desiredGenres",
  "companionAvoidGenres",
  "maxRuntimeMinutes",
  "originPreference",
  "naturalLanguage",
  "explicitlyRequestedGenres",
] as const;

function fail(
  path: string,
  code: MvpRecommendationRequestValidationIssue["code"],
  message: string,
): never {
  throw new MvpRequestValidationError([{ path, code, message }]);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    fail(path, "INVALID_TYPE", "must be a JSON object");
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown) {
    fail(`${path}.${unknown}`, "UNKNOWN_FIELD", "is not allowed");
  }
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(path, "INVALID_VALUE", `must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function parseUniqueEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T[] {
  if (!Array.isArray(value)) {
    fail(path, "INVALID_TYPE", "must be an array");
  }
  if (value.length > allowed.length) {
    fail(
      path,
      "CARDINALITY",
      `must contain at most ${allowed.length} values`,
    );
  }
  const parsed = value.map((item, index) =>
    parseEnum(item, allowed, `${path}[${index}]`),
  );
  if (new Set(parsed).size !== parsed.length) {
    fail(path, "DUPLICATE", "must contain unique values");
  }
  return parsed;
}

function parseUniqueGenreArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    fail(path, "INVALID_TYPE", "must be an array");
  }
  if (value.length > MVP_GENRE_MAX_ITEMS) {
    fail(
      path,
      "CARDINALITY",
      `must contain at most ${MVP_GENRE_MAX_ITEMS} values`,
    );
  }
  const normalized = value.map((item, index) => {
    if (typeof item !== "string") {
      return fail(`${path}[${index}]`, "INVALID_TYPE", "must be a string");
    }
    const genre = item.normalize("NFKC").trim();
    if (!genre) {
      return fail(`${path}[${index}]`, "INVALID_VALUE", "must not be empty");
    }
    if (Array.from(genre).length > MVP_GENRE_MAX_CODE_POINTS) {
      return fail(
        `${path}[${index}]`,
        "CARDINALITY",
        `must contain at most ${MVP_GENRE_MAX_CODE_POINTS} Unicode code points`,
      );
    }
    return genre;
  });
  if (new Set(normalized).size !== normalized.length) {
    fail(path, "DUPLICATE", "must contain unique values");
  }
  return normalized;
}

const sameSet = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
};

function parseResolvedChoice(
  value: unknown,
  requireMeaningfulChoice: boolean,
): ResolvedMvpRecommendationChoice {
  if (value === undefined) {
    value = {};
  }
  assertRecord(value, "request.choice");
  assertAllowedKeys(value, CHOICE_KEYS, "request.choice");

  const selectedProviders =
    value.selectedProviders === undefined
      ? []
      : parseUniqueEnumArray(
          value.selectedProviders,
          OTT_PROVIDERS,
          "request.choice.selectedProviders",
        );
  const companions =
    value.companions === undefined
      ? []
      : parseUniqueEnumArray(
          value.companions,
          COMPANIONS,
          "request.choice.companions",
        );
  if (companions.length > 1) {
    fail(
      "request.choice.companions",
      "CARDINALITY",
      "must contain at most one value",
    );
  }

  const moods =
    value.moods === undefined
      ? []
      : parseUniqueEnumArray(
          value.moods,
          MVP_MOODS,
          "request.choice.moods",
        );
  const desiredGenres =
    value.desiredGenres === undefined
      ? []
      : parseUniqueGenreArray(
          value.desiredGenres,
          "request.choice.desiredGenres",
        );
  const companionAvoidGenres =
    value.companionAvoidGenres === undefined
      ? []
      : parseUniqueGenreArray(
          value.companionAvoidGenres,
          "request.choice.companionAvoidGenres",
        );
  if (companionAvoidGenres.length > 1) {
    fail(
      "request.choice.companionAvoidGenres",
      "CARDINALITY",
      "must contain at most one value",
    );
  }

  const normalizedCompanions =
    companions.length === 0 ? (["ANY"] as Companion[]) : companions;
  if (
    companionAvoidGenres.length > 0 &&
    normalizedCompanions[0] !== "PARTNER" &&
    normalizedCompanions[0] !== "FRIENDS"
  ) {
    fail(
      "request.choice.companionAvoidGenres",
      "POLICY",
      "is allowed only with PARTNER or FRIENDS",
    );
  }

  let maxRuntimeMinutes: 30 | 60 | 120 | 180 | null = null;
  if (value.maxRuntimeMinutes !== undefined) {
    if (
      !CHOICE_RUNTIME_MINUTES.some(
        (runtime) => runtime === value.maxRuntimeMinutes,
      )
    ) {
      fail(
        "request.choice.maxRuntimeMinutes",
        "INVALID_VALUE",
        "must be 30, 60, 120, 180, or null",
      );
    }
    maxRuntimeMinutes = value.maxRuntimeMinutes as
      | 30
      | 60
      | 120
      | 180
      | null;
  }

  const originPreference =
    value.originPreference === undefined
      ? "ANY"
      : parseEnum(
          value.originPreference,
          ORIGIN_PREFERENCES,
          "request.choice.originPreference",
        );

  let naturalLanguage = "";
  const naturalLanguageValue = value.naturalLanguage;
  if (naturalLanguageValue !== undefined) {
    if (typeof naturalLanguageValue !== "string") {
      fail(
        "request.choice.naturalLanguage",
        "INVALID_TYPE",
        "must be a string",
      );
    }
    if (
      Array.from(naturalLanguageValue).length >
      NATURAL_LANGUAGE_MAX_CODE_POINTS
    ) {
      fail(
        "request.choice.naturalLanguage",
        "CARDINALITY",
        `must contain at most ${NATURAL_LANGUAGE_MAX_CODE_POINTS} Unicode code points`,
      );
    }
    naturalLanguage = naturalLanguageValue;
  }

  if (value.explicitlyRequestedGenres !== undefined) {
    const explicit = parseUniqueGenreArray(
      value.explicitlyRequestedGenres,
      "request.choice.explicitlyRequestedGenres",
    );
    if (!sameSet(explicit, desiredGenres)) {
      fail(
        "request.choice.explicitlyRequestedGenres",
        "POLICY",
        "must contain the same set as desiredGenres",
      );
    }
  }

  if (
    requireMeaningfulChoice &&
    selectedProviders.length === 0 &&
    normalizedCompanions[0] === "ANY" &&
    moods.length === 0 &&
    desiredGenres.length === 0 &&
    companionAvoidGenres.length === 0 &&
    maxRuntimeMinutes === null &&
    originPreference === "ANY" &&
    naturalLanguage.trim().length === 0
  ) {
    fail(
      "request.choice",
      "POLICY",
      "추천 조건을 하나 이상 선택해 주세요.",
    );
  }

  return {
    selectedProviders:
      selectedProviders.length === 0
        ? [...OTT_PROVIDERS]
        : selectedProviders,
    companions: normalizedCompanions,
    moods,
    desiredGenres,
    companionAvoidGenres,
    maxRuntimeMinutes,
    originPreference,
    naturalLanguage,
  };
}

/**
 * Strict public DTO validation. Live is the safe default: `scenario` is
 * rejected instead of ignored so callers cannot force Demo policy branches.
 */
export function resolveMvpRecommendationRequest(
  value: unknown,
  options: ResolveMvpRecommendationRequestOptions = {},
): ResolvedMvpRecommendationRequest {
  const profile =
    options.allowScenario === undefined
      ? options.profile ?? "live"
      : options.allowScenario
        ? "demo"
        : "live";
  if (value === undefined) {
    value = {};
  }
  assertRecord(value, "request");
  assertAllowedKeys(
    value,
    profile === "demo" ? DEMO_REQUEST_KEYS : REQUEST_KEYS,
    "request",
  );

  const choice = parseResolvedChoice(
    value.choice,
    options.requireMeaningfulChoice ?? false,
  );
  const scenario =
    profile === "demo"
      ? value.scenario === undefined
        ? "normal"
        : parseEnum(value.scenario, MVP_DEMO_SCENARIOS, "request.scenario")
      : null;
  const transientInput = toMvpSearchInput({ choice });
  return {
    choice,
    scenario,
    transientInput,
    sanitizedInput: sanitizeMvpSearchInput(transientInput),
  };
}

export function validateMvpRecommendationRequest(
  value: unknown,
  options: ResolveMvpRecommendationRequestOptions = {},
): asserts value is MvpRecommendationRequest | MvpDemoRecommendationRequest {
  resolveMvpRecommendationRequest(value, options);
}

export function toMvpSearchInput(
  request: Pick<ResolvedMvpRecommendationRequest, "choice">,
): TransientRecommendationSearchInput {
  const { naturalLanguage, ...sanitized } = request.choice;
  return {
    ...sanitized,
    selectedProviders: [...sanitized.selectedProviders],
    companions: [...sanitized.companions],
    moods: [...sanitized.moods],
    desiredGenres: [...sanitized.desiredGenres],
    companionAvoidGenres: [...sanitized.companionAvoidGenres],
    hasNaturalLanguage: naturalLanguage.trim().length > 0,
    naturalLanguage,
  };
}

export function sanitizeMvpSearchInput(
  input: TransientRecommendationSearchInput,
): SanitizedRecommendationSearchInput {
  return {
    selectedProviders: [...input.selectedProviders],
    companions: [...input.companions],
    moods: [...input.moods],
    desiredGenres: [...input.desiredGenres],
    companionAvoidGenres: [...input.companionAvoidGenres],
    maxRuntimeMinutes: input.maxRuntimeMinutes,
    originPreference: input.originPreference,
    hasNaturalLanguage: input.hasNaturalLanguage,
  };
}

/** @deprecated Compatibility shape for the transitional authenticated Demo. */
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

/** @deprecated Use resolveMvpRecommendationRequest for anonymous code. */
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

/** @deprecated Use toMvpSearchInput for anonymous code. */
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
