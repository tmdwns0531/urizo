import { withMvpComposition } from "@/composition";
import { DemoResetUnavailableError } from "@/domains/recommendation/orchestrator";
import { errorResponse, notFound } from "../../_shared/http";

export async function POST(): Promise<Response> {
  try {
    await withMvpComposition(async ({ services }) => {
      await services.resetForDemo();
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof DemoResetUnavailableError) {
      return errorResponse(notFound("Demo 초기화를 사용할 수 없습니다."));
    }
    return errorResponse(error);
  }
}