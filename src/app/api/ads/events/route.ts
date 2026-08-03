import {
  AD_MEASUREMENT_EVENTS,
  AD_PLACEMENTS,
  type AdMeasurementEvent,
  type AdPlacement,
} from "@/contracts/advertising";
import {
  badRequest,
  errorResponse,
  nonEmptyString,
  readJsonObject,
} from "../../_shared/http";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request, { maximumBytes: 1_024 });
    const campaignId = nonEmptyString(body.campaignId, "campaignId", 100);
    const placement = body.placement as AdPlacement;
    const event = body.event as AdMeasurementEvent;

    if (!AD_PLACEMENTS.includes(placement)) {
      throw badRequest("placement 값이 올바르지 않습니다.");
    }
    if (!AD_MEASUREMENT_EVENTS.includes(event)) {
      throw badRequest("event 값이 올바르지 않습니다.");
    }

    // Deliberately accepts only campaign-level anonymous measurements. A
    // production metrics adapter can consume this validated event later.
    void campaignId;
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
