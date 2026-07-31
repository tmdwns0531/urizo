import { withMvpComposition } from "@/composition";
import {
  MVP_RECOMMENDATION_REQUEST_MAX_BYTES,
  type MvpDemoRecommendationRequest,
  type MvpRecommendationRequest,
} from "@/contracts/mvp-search";
import {
  badRequest,
  errorResponse,
  readJsonObject,
} from "../_shared/http";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request, {
      maximumBytes: MVP_RECOMMENDATION_REQUEST_MAX_BYTES,
    });
    const response = await withMvpComposition(({ services }) =>
      services.recommend(
        body as MvpRecommendationRequest | MvpDemoRecommendationRequest,
      ),
    );
    return Response.json(response, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "MvpRequestValidationError"
    ) {
      return errorResponse(badRequest(error.message));
    }
    return errorResponse(error);
  }
}
