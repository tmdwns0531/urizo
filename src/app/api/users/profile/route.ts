import { services } from "@/composition";
import {
  OTT_PROVIDERS,
  type UserProfilePatch,
} from "@/contracts/user";
import {
  badRequest,
  enumArray,
  errorResponse,
  nonEmptyString,
  readJsonObject,
  stringArray,
} from "../../_shared/http";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function ageFromBirthDate(value: unknown): {
  birthDate: string;
  age: number;
} {
  if (typeof value !== "string") {
    throw badRequest("birthDate 값은 YYYY-MM-DD 형식이어야 합니다.");
  }
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw badRequest("birthDate 값은 YYYY-MM-DD 형식이어야 합니다.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day
  ) {
    throw badRequest("birthDate 값은 실제 존재하는 날짜여야 합니다.");
  }

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (birth > today) {
    throw badRequest("birthDate 값은 미래 날짜일 수 없습니다.");
  }

  let age = today.getUTCFullYear() - year;
  const birthdayHasNotPassed =
    today.getUTCMonth() < month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() < day);
  if (birthdayHasNotPassed) {
    age -= 1;
  }
  if (age < 14) {
    throw badRequest("OTT 다모아는 만 14세 이상만 이용할 수 있습니다.");
  }
  if (age > 120) {
    throw badRequest("birthDate 값을 다시 확인해 주세요.");
  }

  return { birthDate: value, age };
}

function profilePatch(body: Record<string, unknown>): UserProfilePatch {
  const patch: UserProfilePatch = {};

  if (body.displayName !== undefined) {
    patch.displayName = nonEmptyString(body.displayName, "displayName", 20);
  }
  if (body.birthDate !== undefined) {
    patch.birthDate = ageFromBirthDate(body.birthDate).birthDate;
  }
  if (body.subscribedProviders !== undefined) {
    patch.subscribedProviders = enumArray(
      body.subscribedProviders,
      "subscribedProviders",
      OTT_PROVIDERS,
      { allowEmpty: false },
    );
  }
  if (body.allowUnsubscribedRecommendations !== undefined) {
    if (typeof body.allowUnsubscribedRecommendations !== "boolean") {
      throw badRequest(
        "allowUnsubscribedRecommendations 값은 boolean이어야 합니다.",
      );
    }
    patch.allowUnsubscribedRecommendations =
      body.allowUnsubscribedRecommendations;
  }
  if (body.preferredGenres !== undefined) {
    patch.preferredGenres = stringArray(
      body.preferredGenres,
      "preferredGenres",
    );
  }
  if (body.dislikedGenres !== undefined) {
    patch.dislikedGenres = stringArray(
      body.dislikedGenres,
      "dislikedGenres",
    );
  }

  if (Object.keys(patch).length === 0) {
    throw badRequest("변경할 프로필 필드를 하나 이상 보내 주세요.");
  }
  return patch;
}

export async function GET(): Promise<Response> {
  try {
    return Response.json(await services.profile.get());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const patch = profilePatch(body);
    const currentUser = await services.profile.get();
    const updated = await services.profile.update(currentUser.id, patch);
    return Response.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
