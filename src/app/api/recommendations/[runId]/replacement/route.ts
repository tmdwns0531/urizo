import { services } from "@/composition";
import { RecommendationRunAccessError } from "@/domains/recommendation/orchestrator";
import {
  badRequest,
  errorResponse,
  nonEmptyString,
  notFound,
  readJsonObject,
} from "../../../_shared/http";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

function isExpectedReplacementError(error: Error): boolean {
  return (
    error.message.includes("must be completed before replacement") ||
    error.message.includes("is not part of run") ||
    error.message.includes("No safe replacement is available")
  );
}

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
    const contentId = nonEmptyString(body.contentId, "contentId", 100);
    try {
      return Response.json(await services.replace(runId, contentId));
    } catch (error) {
      if (error instanceof RecommendationRunAccessError) {
        throw notFound("추천 기록을 찾을 수 없습니다.");
      }
      if (error instanceof Error && isExpectedReplacementError(error)) {
        throw badRequest(
          "같은 조건을 지키는 안전한 교체 후보를 찾을 수 없습니다.",
        );
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
