import { services } from "@/composition";
import {
  badRequest,
  errorResponse,
  notFound,
} from "../../_shared/http";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { runId: rawRunId } = await context.params;
    const runId = rawRunId.trim();
    if (!runId) {
      throw badRequest("runId 값이 필요합니다.");
    }
    const response = await services.getRun(runId);
    if (!response) {
      throw notFound("추천 기록을 찾을 수 없습니다.");
    }
    return Response.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
