import { withMvpComposition } from "@/composition";
import {
  RecommendationRevisionConflictError,
  RecommendationRunNotFoundError,
  RecommendationRunStateError,
} from "@/domains/recommendation/orchestrator";
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

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { runId: rawRunId } = await context.params;
    const runId = rawRunId.trim();
    if (!runId) throw badRequest("runId 값이 필요합니다.");
    const body = await readJsonObject(request);
    if (Object.keys(body).some((key) => key !== "contentId")) {
      throw badRequest("교체 요청에는 contentId 값만 사용할 수 있습니다.");
    }
    const contentId = nonEmptyString(body.contentId, "contentId", 100);
    const response = await withMvpComposition(({ services }) =>
      services.replace(runId, contentId),
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
        badRequest("같은 조건을 지키는 안전한 교체 후보를 찾을 수 없습니다."),
      );
    }
    return errorResponse(error);
  }
}