import type {
  ApprovalRequest,
  DemoResetResponse,
  HealthResponse,
  MvpApiContract,
  MvpDemoApiContract,
  ReplacementRequest,
  RunPathParameters,
} from "../src/contracts/mvp-api";
import type {
  AgentTraceRepository,
  DemoResettable,
  RecommendationRunRepository,
  RecommendationSearchAdapter,
  RecommendationSelectorAdapter,
} from "../src/contracts/mvp-ports";
import type {
  AnonymousRecommendationServices,
  ErrorResponse,
  MvpAwaitingApprovalRecommendationResponse,
  MvpCompletedRecommendationResponse,
  MvpRecommendationExecutionResult,
  MvpRecommendationResponse,
  MvpPublicTraceEvent,
  NewTraceEvent,
  PublicErrorCode,
  RuleBasedFallbackInput,
  RunUpdateResult,
  StoredResponseSnapshot,
  StoredRecommendationRun,
  StoredTraceEvent,
  TraceMetricKey,
  TraceMetrics,
} from "../src/contracts/mvp-recommendation";
import type {
  ChoiceRuntimeMinutes,
  EffectiveRuntimeMinutes,
  MvpDemoRecommendationRequest,
  MvpRecommendationChoice,
  MvpRecommendationRequest,
  Mood,
  QueryVectorSnapshot,
  RecommendationSearchContinuation,
  RecommendationSearchInvocation,
  RecommendationSearchOutput,
  RecommendationSearchResult,
  SanitizedRecommendationSearchInput,
  TransientRecommendationSearchInput,
} from "../src/contracts/mvp-search";
import type { MvpAdapterConfig } from "../src/config/adapters";
import type {
  MvpAdapterSet,
  MvpComposition,
} from "../src/composition/types";
import type {
  ExecutionAttempt,
  MvpRecommendationExecutionContext,
  MvpRecommendationExecutor,
} from "../src/domains/recommendation/executors/types";
import type {
  RecommendationRequest as LegacyRecommendationRequest,
} from "../src/contracts/recommendation";
import type {
  ProviderAvailability,
  ProviderLinkType,
} from "../src/contracts/catalog";
import type { CatalogRepository } from "../src/contracts/ports";

type Assert<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;
type IsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type IsFalse<T extends boolean> = T extends false ? true : false;

type ForbiddenPersistenceKey =
  | "userId"
  | "user"
  | "userSnapshot"
  | "naturalLanguage"
  | "naturalLanguageQuery"
  | "token"
  | "matchedTerms"
  | "prompt"
  | "rawPrompt";

export type PublicChoiceDtoMatchesV07 = Assert<
  IsExact<
    MvpRecommendationChoice,
    {
      selectedProviders?: import("../src/contracts/catalog").OttProvider[];
      companions?: import("../src/contracts/mvp-search").Companion[];
      moods?: Mood[];
      desiredGenres?: string[];
      companionAvoidGenres?: string[];
      maxRuntimeMinutes?: ChoiceRuntimeMinutes;
      originPreference?: import("../src/contracts/mvp-search").OriginPreference;
      naturalLanguage?: string;
      explicitlyRequestedGenres?: string[];
    }
  >
>;

export type PublicRequestHasNoLegacyIdentityOrScenario = Assert<
  IsNever<Extract<keyof MvpRecommendationRequest, "userId" | "scenario">>
>;

export type DemoRequestAddsOnlyScenario = Assert<
  IsExact<keyof MvpDemoRecommendationRequest, "choice" | "scenario">
>;

export type ActiveAndLegacyRequestsAreSeparate = Assert<
  IsFalse<IsExact<MvpRecommendationRequest, LegacyRecommendationRequest>>
>;

export type RuntimeContractsAreExact = Assert<
  IsExact<ChoiceRuntimeMinutes, 30 | 60 | 120 | 180 | null>
>;

export type EffectiveRuntimeAddsOnlyApprovalValue = Assert<
  IsExact<EffectiveRuntimeMinutes, ChoiceRuntimeMinutes | 45>
>;

export type ProviderLinkTypesAreExact = Assert<
  IsExact<ProviderLinkType, "DIRECT" | "SEARCH" | "HOME">
>;

export type ProviderAvailabilityCarriesLinkSemantics = Assert<
  IsExact<
    keyof ProviderAvailability,
    "provider" | "watchUrl" | "linkType"
  >
>;

export type StoredRunHasNoForbiddenField = Assert<
  IsNever<Extract<keyof StoredRecommendationRun, ForbiddenPersistenceKey>>
>;

export type StoredRequestHasNoForbiddenField = Assert<
  IsNever<
    Extract<
      keyof StoredRecommendationRun["requestSnapshot"],
      ForbiddenPersistenceKey
    >
  >
>;

export type SanitizedInputHasNoForbiddenField = Assert<
  IsNever<
    Extract<keyof SanitizedRecommendationSearchInput, ForbiddenPersistenceKey>
  >
>;

export type QueryVectorHasNoTextDiagnostics = Assert<
  IsNever<Extract<keyof QueryVectorSnapshot, "token" | "matchedTerms">>
>;

export type QueryVectorShapeIsFixed = Assert<
  IsExact<
    QueryVectorSnapshot,
    | {
        algorithm: "local-hash-cosine-v1";
        version: 1;
        dimensions: 64;
        values: number[];
      }
    | {
        algorithm: "openai-text-embedding-3-small-v1";
        version: 1;
        dimensions: 1536;
        values: number[];
      }
  >
>;

export type SearchContinuationShapeIsFixed = Assert<
  IsExact<
    keyof RecommendationSearchContinuation,
    "queryVector" | "inputFingerprint"
  >
>;

export type SearchInvocationKindsAreFixed = Assert<
  IsExact<RecommendationSearchInvocation["kind"], "initial" | "continuation">
>;

export type InitialSearchCarriesOnlyTransientInput = Assert<
  IsExact<
    Extract<RecommendationSearchInvocation, { kind: "initial" }>["input"],
    TransientRecommendationSearchInput
  >
>;

export type ContinuationSearchCarriesSanitizedInput = Assert<
  IsExact<
    Extract<RecommendationSearchInvocation, { kind: "continuation" }>["input"],
    SanitizedRecommendationSearchInput
  >
>;

export type SearchResultHasNoMatchedTerms = Assert<
  IsNever<Extract<keyof RecommendationSearchResult, "matchedTerms">>
>;

export type SearchOutputCarriesContinuation = Assert<
  IsExact<
    keyof RecommendationSearchOutput,
    "results" | "continuation" | "modelCallCount" | "tokenUsage"
  >
>;

export type NewTraceCallerCannotAssignSequence = Assert<
  IsNever<
    Extract<keyof NewTraceEvent, "id" | "runId" | "sequence" | "createdAt">
  >
>;

export type StoredTraceSequenceIsNumber = Assert<
  IsExact<StoredTraceEvent["sequence"], number>
>;

export type RunUpdateExpectedRevisionIsNumber = Assert<
  IsExact<Parameters<RecommendationRunRepository["update"]>[1], number>
>;

export type RunPatchCannotChangeRevision = Assert<
  IsNever<
    Extract<
      keyof Parameters<RecommendationRunRepository["update"]>[2],
      "id" | "revision" | "createdAt"
    >
  >
>;

export type RunUpdateFailureReasonsAreFixed = Assert<
  IsExact<
    Extract<RunUpdateResult, { ok: false }>["reason"],
    "NOT_FOUND" | "REVISION_CONFLICT"
  >
>;

export type AgentTraceAppendInputIsSanitized = Assert<
  IsExact<Parameters<AgentTraceRepository["append"]>[1], NewTraceEvent>
>;

export type PublicTraceMessageIsRequired = Assert<
  IsExact<
    Extract<NewTraceEvent, { visibility: "PUBLIC" }>["publicMessage"],
    string
  >
>;

export type InternalTraceMessageMayBeNull = Assert<
  IsExact<
    Extract<NewTraceEvent, { visibility: "INTERNAL" }>["publicMessage"],
    string | null
  >
>;

export type AgentTraceRepositoryMethodsAreExact = Assert<
  IsExact<keyof AgentTraceRepository, "append" | "listStored">
>;

export type RunRepositoryMethodsAreExact = Assert<
  IsExact<keyof RecommendationRunRepository, "create" | "get" | "update">
>;

export type SearchAdapterMethodIsExact = Assert<
  IsExact<keyof RecommendationSearchAdapter, "search">
>;

export type SelectorAdapterMethodIsExact = Assert<
  IsExact<keyof RecommendationSelectorAdapter, "select">
>;

export type DemoResetCapabilityIsSeparate = Assert<
  IsExact<keyof DemoResettable, "clearForDemo">
>;

export type StoredResponseNeverContainsTrace = Assert<
  IsNever<Extract<keyof StoredResponseSnapshot, "trace">>
>;

export type StoredRunFieldsAreExact = Assert<
  IsExact<
    keyof StoredRecommendationRun,
    | "id"
    | "status"
    | "revision"
    | "executionMode"
    | "inputFingerprint"
    | "requestSnapshot"
    | "queryVector"
    | "responseSnapshot"
    | "excludedContentIds"
    | "replacedContentIds"
    | "candidateCount"
    | "resultCount"
    | "modelCallCount"
    | "toolCallCount"
    | "totalTokens"
    | "durationMs"
    | "policyBlockCount"
    | "fallbackReason"
    | "errorCode"
    | "startedAt"
    | "completedAt"
    | "createdAt"
    | "updatedAt"
  >
>;

export type TraceMetricKeysAreExact = Assert<
  IsExact<
    TraceMetricKey,
    | "candidateCount"
    | "eligibleCount"
    | "resultCount"
    | "blockedCount"
    | "modelCalls"
    | "toolCalls"
    | "tokens"
    | "durationMs"
    | "effectiveRuntimeMinutes"
  >
>;

export type TraceMetricsContainNumbersOnly = Assert<
  IsExact<TraceMetrics, Partial<Record<TraceMetricKey, number>>>
>;

export type ExecutionAttemptKindsAreFixed = Assert<
  IsExact<ExecutionAttempt["kind"], "success" | "fallback_required">
>;

export type ExecutionSuccessCarriesActiveResult = Assert<
  IsExact<
    Extract<ExecutionAttempt, { kind: "success" }>["result"],
    MvpRecommendationExecutionResult
  >
>;

export type FallbackAttemptCarriesSafeInput = Assert<
  IsExact<
    Extract<ExecutionAttempt, { kind: "fallback_required" }>["fallbackInput"],
    RuleBasedFallbackInput
  >
>;

export type MvpApiNamesAreFixed = Assert<
  IsExact<
    keyof MvpApiContract,
    | "createRecommendation"
    | "getRecommendation"
    | "decideApproval"
    | "replaceRecommendation"
    | "health"
    | "resetDemo"
  >
>;

export type CreateApiDtoIsExact = Assert<
  IsExact<
    MvpApiContract["createRecommendation"],
    {
      params: undefined;
      request: MvpRecommendationRequest;
      response: MvpRecommendationResponse;
      error: ErrorResponse;
    }
  >
>;

export type GetApiDtoIsExact = Assert<
  IsExact<
    MvpApiContract["getRecommendation"],
    {
      params: RunPathParameters;
      request: undefined;
      response: MvpRecommendationResponse;
      error: ErrorResponse;
    }
  >
>;

export type ApprovalApiDtoIsExact = Assert<
  IsExact<
    MvpApiContract["decideApproval"]["request"],
    ApprovalRequest
  >
>;

export type ReplacementApiDtoIsExact = Assert<
  IsExact<
    MvpApiContract["replaceRecommendation"]["request"],
    ReplacementRequest
  >
>;

export type HealthAndResetDtosAreExact = Assert<
  IsExact<MvpApiContract["health"]["response"], HealthResponse>
>;

export type HealthDtoSupportsDemoAndLiveAdapters = Assert<
  IsExact<
    HealthResponse["adapters"],
    {
      catalog: "fixture" | "prisma";
      search: "local" | "pgvector";
      selector: "deterministic" | "openai";
      runStore: "memory" | "prisma";
      traceStore: "memory" | "prisma";
    }
  >
>;

export type HealthDtoHasBothProfileFlags = Assert<
  IsExact<HealthResponse["fullyDemo" | "fullyLive"], boolean>
>;

export type ResetDtoIsExact = Assert<
  IsExact<MvpApiContract["resetDemo"]["response"], DemoResetResponse>
>;

export type PublicErrorCodesAreExact = Assert<
  IsExact<PublicErrorCode, "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL_ERROR">
>;

export type DemoApiAddsScenarioOnlyToCreateDto = Assert<
  IsExact<
    MvpDemoApiContract["createRecommendation"]["request"],
    MvpDemoRecommendationRequest
  >
>;

export type MvpAdapterConfigKeysAreExact = Assert<
  IsExact<
    keyof MvpAdapterConfig,
    | "appProfile"
    | "catalog"
    | "search"
    | "selector"
    | "runStore"
    | "traceStore"
  >
>;

export type MvpAdapterSetKeysAreExact = Assert<
  IsExact<
    keyof MvpAdapterSet,
    "catalog" | "search" | "selector" | "runs" | "traces"
  >
>;

export type MvpCompositionUsesActiveSet = Assert<
  IsExact<MvpComposition["adapters"], MvpAdapterSet>
>;

export type MvpCompositionKeysAreExact = Assert<
  IsExact<keyof MvpComposition, "adapters" | "services" | "dispose">
>;

export type AnonymousServiceMethodsAreExact = Assert<
  IsExact<
    keyof AnonymousRecommendationServices,
    "recommend" | "getRun" | "decideApproval" | "replace" | "resetForDemo"
  >
>;

export type ActiveExecutorReturnsExecutionAttempt = Assert<
  IsExact<
    Awaited<ReturnType<MvpRecommendationExecutor["execute"]>>,
    ExecutionAttempt
  >
>;

export type ActiveExecutorContextIsExact = Assert<
  IsExact<
    Parameters<MvpRecommendationExecutor["execute"]>[0],
    MvpRecommendationExecutionContext
  >
>;

export type ActiveExecutorContextKeysAreExact = Assert<
  IsExact<
    keyof MvpRecommendationExecutionContext,
    "runId" | "searchInvocation" | "budget" | "selectionMode"
  >
>;

export type PublicResponseVariantsAreFixed = Assert<
  IsExact<
    MvpRecommendationResponse,
    | MvpCompletedRecommendationResponse
    | MvpAwaitingApprovalRecommendationResponse
  >
>;

export type PublicTraceUsesNumericAllowlistMetrics = Assert<
  IsExact<
    NonNullable<MvpPublicTraceEvent["metrics"]>,
    TraceMetrics
  >
>;

/*
 * Compile-only owner mocks prove that every vertical slice can import and
 * satisfy its boundary before another owner's concrete implementation lands.
 */
export const owner2CatalogMock = {
  async list() {
    return [];
  },
  async getById() {
    return null;
  },
} satisfies CatalogRepository;

export const owner3SearchMock = {
  async search() {
    throw new Error("compile-only search mock");
  },
} satisfies RecommendationSearchAdapter;

export const owner4SelectorMock = {
  async select() {
    return {
      selectedIds: [],
      tokenUsage: 0,
    };
  },
} satisfies RecommendationSelectorAdapter;

export const owner1RunMock = {
  async create() {},
  async get() {
    return null;
  },
  async update() {
    return {
      ok: false,
      reason: "REVISION_CONFLICT",
    } as const;
  },
} satisfies RecommendationRunRepository;

export const owner5TraceMock = {
  async append() {
    throw new Error("compile-only Trace mock");
  },
  async listStored() {
    return [];
  },
} satisfies AgentTraceRepository;

export const owner5ServiceMock = {
  async recommend() {
    throw new Error("compile-only recommendation mock");
  },
  async getRun() {
    return null;
  },
  async decideApproval() {
    throw new Error("compile-only approval mock");
  },
  async replace() {
    throw new Error("compile-only replacement mock");
  },
  async resetForDemo() {},
} satisfies AnonymousRecommendationServices;

export const owner1CompositionMock = {
  adapters: {
    catalog: owner2CatalogMock,
    search: owner3SearchMock,
    selector: owner4SelectorMock,
    runs: owner1RunMock,
    traces: owner5TraceMock,
  },
  services: owner5ServiceMock,
  async dispose() {},
} satisfies MvpComposition;
