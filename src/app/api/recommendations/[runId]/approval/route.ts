import { withMvpComposition } from "@/composition";
import type { MvpApprovalDecision } from "@/contracts/mvp-recommendation";
import {
  RecommendationRevisionConflictError,
  RecommendationRunNotFoundError,
  RecommendationRunStateError,
} from "@/domains/recommendation/orchestrator";
import {
  badRequest,
  enumValue,
  errorResponse,
  notFound,
  readJsonObject,
} from "../../../_shared/http";

const APPROVAL_DECISIONS = ["approve", "reject"] as const;

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { runId: rawRunId } = await context.params;
    const runId = rawRunId.trim();
    if (!runId) throw badRequest("runId 값이 필요합니다.");
    const body = await readJsonObject(request);
    if (Object.keys(body).some((key) => key !== "decision")) {
      throw badRequest("승인 요청에는 decision 값만 사용할 수 있습니다.");
    }
    const decision: MvpApprovalDecision = enumValue(
      body.decision,
      "decision",
      APPROVAL_DECISIONS,
    );
    const response = await withMvpComposition(({ services }) =>
      services.decideApproval(runId, decision),
    );
    return Response.json(response);
  } catch (error) {
    if (error instanceof RecommendationRunNotFoundError) {
      return errorResponse(notFound("추천 기록을 찾을 수 없습니다."));
    }
    if (
      error instanceof RecommendationRunStateError ||
      error instanceof RecommendationRevisionConflictError
    ) {
      return errorResponse(
        badRequest("이 추천은 현재 승인 결정을 받을 수 없습니다."),
      );
    }
    return errorResponse(error);
  }
}