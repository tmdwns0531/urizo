import type {
  AuthAdapter,
  EngagementRepository,
  ProfileRepository,
  RunRepository,
  TraceRepository,
} from "../../contracts/ports";
import type {
  ApprovalDecision,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationRun,
} from "../../contracts/recommendation";
import type {
  EngagementCommand,
  EngagementEvent,
} from "../../contracts/engagement";
import type { UserContext, UserProfilePatch } from "../../contracts/user";
import { createId } from "../../adapters/shared/id";
import type { RecommendationExecutor } from "./executors/types";
import type { PolicyResult } from "./policy";
import { PolicyLayer } from "./policy";
import { resolveRecommendationRequest } from "./request";
import { PublicTraceWriter } from "./trace";

export interface RecommendationServices {
  recommend(request?: RecommendationRequest): Promise<RecommendationResponse>;
  getRun(runId: string): Promise<RecommendationResponse | null>;
  decideApproval(
    runId: string,
    decision: ApprovalDecision,
  ): Promise<RecommendationResponse>;
  replace(
    runId: string,
    contentId: string,
  ): Promise<RecommendationResponse>;
  listRuns(): Promise<RecommendationResponse[]>;
  profile: {
    get(userId?: string): Promise<UserContext>;
    update(
      userId: string,
      patch: UserProfilePatch,
    ): Promise<UserContext>;
  };
  engagement: {
    record(input: EngagementCommand): Promise<EngagementEvent>;
    list(userId?: string): Promise<EngagementEvent[]>;
  };
  reset(): Promise<void>;
}

interface OrchestratorDependencies {
  auth: AuthAdapter;
  executor: RecommendationExecutor;
  policy: PolicyLayer;
  runs: RunRepository;
  traces: TraceRepository;
  profiles: ProfileRepository;
  engagements: EngagementRepository;
}

export class RecommendationOrchestrator
  implements RecommendationServices
{
  readonly profile: RecommendationServices["profile"];
  readonly engagement: RecommendationServices["engagement"];

  constructor(private readonly dependencies: OrchestratorDependencies) {
    this.profile = {
      get: (userId?: string) => this.dependencies.auth.getUser(userId),
      update: (userId: string, patch: UserProfilePatch) =>
        this.dependencies.profiles.update(userId, patch),
    };
    this.engagement = {
      record: (input: EngagementCommand) =>
        this.recordEngagement(input),
      list: (userId?: string) =>
        this.dependencies.engagements.list(userId),
    };
  }

  async recommend(
    request: RecommendationRequest = {},
  ): Promise<RecommendationResponse> {
    const owner = await this.dependencies.auth.getUser();
    const policySubject =
      request.scenario === "policy_block"
        ? await this.dependencies.auth.getUser("demo-minor")
        : owner;
    const resolved = resolveRecommendationRequest(
      {
        choice: request.choice,
        scenario: request.scenario,
      },
      owner.id,
    );
    const runId = createId("run");
    const trace = new PublicTraceWriter(runId, this.dependencies.traces);
    const createdAt = new Date().toISOString();
    const result = await this.dependencies.policy.execute(
      runId,
      policySubject,
      resolved,
      this.dependencies.executor,
      trace,
    );
    const response = await this.responseFromPolicy(
      runId,
      createdAt,
      result,
      trace,
    );
    await this.dependencies.runs.save({
      id: runId,
      userId: owner.id,
      policySubjectUserId: policySubject.id,
      request: resolved,
      response,
      excludedContentIds: result.excludedContentIds,
      replacedContentIds: [],
    });
    return response;
  }

  async getRun(runId: string): Promise<RecommendationResponse | null> {
    const run = await this.findOwnedRun(runId);
    if (!run) {
      return null;
    }
    return {
      ...run.response,
      trace: await this.dependencies.traces.list(runId),
    };
  }

  async decideApproval(
    runId: string,
    decision: ApprovalDecision,
  ): Promise<RecommendationResponse> {
    const run = await this.requireOwnedRun(runId);
    if (run.response.status !== "awaiting_approval") {
      throw new Error(`Run "${runId}" is not waiting for approval.`);
    }
    const trace = new PublicTraceWriter(runId, this.dependencies.traces);

    if (decision === "reject") {
      await trace.emit("approval_decision", {
        title: "30분 조건을 그대로 유지했어요",
        description:
          "사용자 선택에 따라 조건을 넓히지 않고 찾은 작품만 보여드립니다.",
        metrics: {
          승인: false,
          결과: run.response.partialRecommendations.length,
        },
      });
      await trace.emit("complete", {
        title: `${run.response.partialRecommendations.length}편으로 추천을 마쳤어요`,
        description:
          "조건을 임의로 완화하지 않고 사용자의 결정을 그대로 반영했습니다.",
        metrics: {
          결과: run.response.partialRecommendations.length,
        },
      });
      const now = new Date().toISOString();
      const response: RecommendationResponse = {
        status: "completed",
        runId,
        createdAt: run.response.createdAt,
        updatedAt: now,
        trace: await trace.list(),
        recommendations: run.response.partialRecommendations,
        topPick: run.response.partialRecommendations[0] ?? null,
        fallbackUsed: false,
        policyBlockedCount: run.response.policyBlockedCount,
        notice: `30분 조건에 맞는 ${run.response.partialRecommendations.length}편만 보여드려요.`,
      };
      await this.dependencies.runs.save({
        ...run,
        response,
      });
      return response;
    }

    await trace.emit("approval_decision", {
      title: "45분까지 넓혀 다시 찾아볼게요",
      description:
        "사용자가 승인한 시간 조건만 완화하고 연령, 구독 OTT 등 안전 조건은 유지합니다.",
      metrics: {
        승인: true,
        변경전: 30,
        변경후: 45,
      },
    });
    const user = await this.dependencies.auth.getUser(
      run.policySubjectUserId,
    );
    const approvedRequest = resolveRecommendationRequest(
      {
        ...run.request,
        scenario: "normal",
        choice: {
          ...run.request.choice,
          maxRuntimeMinutes: 45,
        },
      },
      run.userId,
    );
    const result = await this.dependencies.policy.execute(
      runId,
      user,
      approvedRequest,
      this.dependencies.executor,
      trace,
    );
    const response = await this.responseFromPolicy(
      runId,
      run.response.createdAt,
      result,
      trace,
    );
    await this.dependencies.runs.save({
      ...run,
      request: approvedRequest,
      response,
      excludedContentIds: result.excludedContentIds,
    });
    return response;
  }

  async replace(
    runId: string,
    contentId: string,
  ): Promise<RecommendationResponse> {
    const run = await this.requireOwnedRun(runId);
    if (run.response.status !== "completed") {
      throw new Error(`Run "${runId}" must be completed before replacement.`);
    }
    const replacementIndex = run.response.recommendations.findIndex(
      ({ content }) => content.id === contentId,
    );
    if (replacementIndex < 0) {
      throw new Error(
        `Content "${contentId}" is not part of run "${runId}".`,
      );
    }

    const user = await this.dependencies.auth.getUser(
      run.policySubjectUserId,
    );
    const request = resolveRecommendationRequest(run.request, run.userId);
    const trace = new PublicTraceWriter(runId, this.dependencies.traces);
    const outcome = await this.dependencies.policy.selectSafeReplacement(
      runId,
      user,
      request,
      this.dependencies.executor,
      trace,
      run.response.recommendations,
      run.replacedContentIds,
      contentId,
    );

    const recommendations = [...run.response.recommendations];
    recommendations[replacementIndex] = {
      ...outcome.replacement,
      replacementOf: contentId,
    };
    const response: RecommendationResponse = {
      ...run.response,
      updatedAt: new Date().toISOString(),
      trace: await trace.list(),
      recommendations,
      topPick: recommendations[0] ?? null,
      fallbackUsed: run.response.fallbackUsed || outcome.fallbackUsed,
      policyBlockedCount:
        run.response.policyBlockedCount + outcome.policyBlockedCount,
    };
    await this.dependencies.runs.save({
      ...run,
      response,
      excludedContentIds: [
        ...new Set([
          ...run.excludedContentIds,
          ...outcome.excludedContentIds,
        ]),
      ],
      replacedContentIds: [...run.replacedContentIds, contentId],
    });
    return response;
  }

  async listRuns(): Promise<RecommendationResponse[]> {
    const owner = await this.dependencies.auth.getUser();
    const runs = await this.dependencies.runs.list(owner.id);
    return Promise.all(
      runs.map(async (run) => ({
        ...run.response,
        trace: await this.dependencies.traces.list(run.id),
      })),
    );
  }

  async reset(): Promise<void> {
    await Promise.all([
      this.dependencies.runs.clear(),
      this.dependencies.traces.clear(),
      this.dependencies.engagements.clear(),
      this.dependencies.profiles.clear(),
    ]);
  }

  private async responseFromPolicy(
    runId: string,
    createdAt: string,
    result: PolicyResult,
    trace: PublicTraceWriter,
  ): Promise<RecommendationResponse> {
    const updatedAt = new Date().toISOString();
    const events = await trace.list();
    if (result.status === "awaiting_approval") {
      return {
        status: "awaiting_approval",
        runId,
        createdAt,
        updatedAt,
        trace: events,
        proposal: result.proposal,
        partialRecommendations: result.partialRecommendations,
        fallbackUsed: false,
        policyBlockedCount: result.policyBlockedCount,
      };
    }
    return {
      status: "completed",
      runId,
      createdAt,
      updatedAt,
      trace: events,
      recommendations: result.recommendations,
      topPick: result.recommendations[0] ?? null,
      fallbackUsed: result.fallbackUsed,
      policyBlockedCount: result.policyBlockedCount,
      notice: result.notice,
    };
  }

  private async findOwnedRun(
    runId: string,
  ): Promise<RecommendationRun | null> {
    const [owner, run] = await Promise.all([
      this.dependencies.auth.getUser(),
      this.dependencies.runs.get(runId),
    ]);
    return run?.userId === owner.id ? run : null;
  }

  private async requireOwnedRun(
    runId: string,
  ): Promise<RecommendationRun> {
    const run = await this.findOwnedRun(runId);
    if (!run) {
      throw new RecommendationRunAccessError();
    }
    return run;
  }

  private async recordEngagement(
    command: EngagementCommand,
  ): Promise<EngagementEvent> {
    const authenticatedUser = await this.dependencies.auth.getUser();
    if (command.runId) {
      const run = await this.dependencies.runs.get(command.runId);
      const runContents =
        run?.response.status === "completed"
          ? run.response.recommendations
          : run?.response.partialRecommendations ?? [];
      const contentBelongsToRun = runContents.some(
        ({ content }) => content.id === command.contentId,
      );
      if (
        !run ||
        run.userId !== authenticatedUser.id ||
        !contentBelongsToRun
      ) {
        throw new EngagementRunAccessError();
      }
    }

    const input = {
      ...command,
      userId: authenticatedUser.id,
    };
    const event = await this.dependencies.engagements.record(input);
    const profile = authenticatedUser;
    const add = (values: string[], value: string): string[] =>
      values.includes(value) ? values : [...values, value];
    let next = profile;

    if (input.type === "BOOKMARK") {
      next = {
        ...next,
        bookmarkedContentIds: add(
          next.bookmarkedContentIds,
          input.contentId,
        ),
      };
    } else if (input.type === "UNBOOKMARK") {
      next = {
        ...next,
        bookmarkedContentIds: next.bookmarkedContentIds.filter(
          (id) => id !== input.contentId,
        ),
      };
    } else if (input.type === "WATCHED") {
      next = {
        ...next,
        watchedContentIds: add(
          next.watchedContentIds,
          input.contentId,
        ),
      };
    } else if (input.type === "NOT_INTERESTED") {
      next = {
        ...next,
        notInterestedContentIds: add(
          next.notInterestedContentIds,
          input.contentId,
        ),
        bookmarkedContentIds: next.bookmarkedContentIds.filter(
          (id) => id !== input.contentId,
        ),
      };
    }

    if (next !== profile) {
      await this.dependencies.profiles.save(next);
    }
    return event;
  }
}

export class RecommendationRunAccessError extends Error {
  constructor() {
    super("The recommendation run was not found.");
    this.name = "RecommendationRunAccessError";
  }
}

export class EngagementRunAccessError extends Error {
  constructor() {
    super("The recommendation run is not accessible for engagement.");
    this.name = "EngagementRunAccessError";
  }
}
