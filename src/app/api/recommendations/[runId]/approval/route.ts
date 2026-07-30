import { services } from "@/composition";
import { type ApprovalDecision } from "@/contracts/recommendation";
import { RecommendationRunAccessError } from "@/domains/recommendation/orchestrator";
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
    if (!runId) {
      throw badRequest("runId 값이 필요합니다.");
    }
    if (!(await services.getRun(runId))) {
      throw notFound("추천 기록을 찾을 수 없습니다.");
    }

    const body = await readJsonObject(request);
    const decision: ApprovalDecision = enumValue(
      body.decision,
      "decision",
      APPROVAL_DECISIONS,
    );
    try {
      return Response.json(await services.decideApproval(runId, decision));
    } catch (error) {
      if (error instanceof RecommendationRunAccessError) {
        throw notFound("추천 기록을 찾을 수 없습니다.");
      }
      if (
        error instanceof Error &&
        error.message.includes("is not waiting for approval")
      ) {
        throw badRequest("이 추천은 현재 승인을 기다리는 상태가 아닙니다.");
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
