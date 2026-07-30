import { composition, services } from "@/composition";
import {
  ENGAGEMENT_TYPES,
  type EngagementCommand,
} from "@/contracts/engagement";
import { EngagementRunAccessError } from "@/domains/recommendation/orchestrator";
import {
  badRequest,
  enumValue,
  errorResponse,
  nonEmptyString,
  notFound,
  optionalString,
  readJsonObject,
} from "../_shared/http";

export async function GET(): Promise<Response> {
  try {
    const user = await services.profile.get();
    const [events, catalog] = await Promise.all([
      services.engagement.list(user.id),
      composition.adapters.catalog.list(),
    ]);
    const contentIds = new Set(events.map((event) => event.contentId));
    const contents = catalog.filter((content) => contentIds.has(content.id));
    return Response.json({ events, contents });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const contentId = nonEmptyString(body.contentId, "contentId", 100);
    const type = enumValue(body.type, "type", ENGAGEMENT_TYPES);
    const content =
      await composition.adapters.catalog.getById(contentId);
    if (!content) {
      throw notFound("피드백을 남길 작품을 찾을 수 없습니다.");
    }

    const runId = optionalString(body.runId, "runId", 100);
    const provider = optionalString(body.provider, "provider", 100);
    if (type === "OTT_CLICK" && !provider) {
      throw badRequest("OTT_CLICK 이벤트에는 provider 값이 필요합니다.");
    }
    if (
      type === "OTT_CLICK" &&
      provider &&
      !content.providers.some((item) => item.provider === provider)
    ) {
      throw badRequest("이 작품에서 사용할 수 없는 OTT provider입니다.");
    }

    const input: EngagementCommand = {
      contentId,
      type,
      ...(runId ? { runId } : {}),
      ...(provider ? { provider } : {}),
    };
    const event = await services.engagement.record(input);
    return Response.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof EngagementRunAccessError) {
      return errorResponse(
        notFound("참여를 기록할 추천 결과를 찾을 수 없습니다."),
      );
    }
    return errorResponse(error);
  }
}
