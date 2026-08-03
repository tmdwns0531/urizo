import { withCuratorComposition } from "@/composition/curator";
import { CURATOR_REQUEST_MAX_BYTES } from "@/contracts/curator";
import { CuratorRequestValidationError } from "@/domains/curator/conversation";
import {
  badRequest,
  errorResponse,
  readJsonObject,
} from "../../_shared/http";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request, {
      maximumBytes: CURATOR_REQUEST_MAX_BYTES,
    });
    const response = await withCuratorComposition(({ services }) =>
      services.turn(body, request.signal),
    );
    return Response.json(response);
  } catch (error) {
    if (error instanceof CuratorRequestValidationError) {
      return errorResponse(badRequest(error.message));
    }
    return errorResponse(error);
  }
}
