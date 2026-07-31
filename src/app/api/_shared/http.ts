import type {
  ErrorResponse,
  PublicErrorCode,
} from "@/contracts/mvp-recommendation";

export const ERROR_CODES = {
  badRequest: "BAD_REQUEST",
  notFound: "NOT_FOUND",
  internal: "INTERNAL_ERROR",
} as const;

type ErrorCode = PublicErrorCode;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 500,
    readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string): ApiError {
  return new ApiError(message, 400, ERROR_CODES.badRequest);
}

export function notFound(message: string): ApiError {
  return new ApiError(message, 404, ERROR_CODES.notFound);
}

export function jsonError(
  message: string,
  status: 400 | 404 | 500,
  code: ErrorCode,
): Response {
  const body = { error: message, code } satisfies ErrorResponse;
  return Response.json(body, { status });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status, error.code);
  }

  return jsonError(
    "요청을 처리하는 중 문제가 발생했습니다.",
    500,
    ERROR_CODES.internal,
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw badRequest("요청 본문을 읽을 수 없습니다.");
  }

  if (!raw.trim()) {
    return {};
  }

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw badRequest("요청 본문은 올바른 JSON이어야 합니다.");
  }

  if (!isRecord(value)) {
    throw badRequest("요청 본문은 JSON 객체여야 합니다.");
  }

  return value;
}

export function nonEmptyString(
  value: unknown,
  field: string,
  maximumLength = 200,
): string {
  if (typeof value !== "string") {
    throw badRequest(`${field} 값은 문자열이어야 합니다.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw badRequest(`${field} 값은 비어 있을 수 없습니다.`);
  }
  if (normalized.length > maximumLength) {
    throw badRequest(
      `${field} 값은 ${maximumLength}자를 넘을 수 없습니다.`,
    );
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  field: string,
  maximumLength = 200,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return nonEmptyString(value, field, maximumLength);
}

export function stringArray(
  value: unknown,
  field: string,
  options: {
    maximumItems?: number;
    maximumItemLength?: number;
    allowEmpty?: boolean;
  } = {},
): string[] {
  if (!Array.isArray(value)) {
    throw badRequest(`${field} 값은 문자열 배열이어야 합니다.`);
  }

  const {
    maximumItems = 20,
    maximumItemLength = 40,
    allowEmpty = true,
  } = options;
  if (!allowEmpty && value.length === 0) {
    throw badRequest(`${field} 값은 하나 이상 선택해야 합니다.`);
  }
  if (value.length > maximumItems) {
    throw badRequest(
      `${field} 값은 최대 ${maximumItems}개까지 선택할 수 있습니다.`,
    );
  }

  const normalized = value.map((item) =>
    nonEmptyString(item, field, maximumItemLength),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw badRequest(`${field} 값에는 중복 항목을 넣을 수 없습니다.`);
  }
  return normalized;
}

export function enumValue<const T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
): T[number] {
  if (
    typeof value !== "string" ||
    !allowed.includes(value as T[number])
  ) {
    throw badRequest(
      `${field} 값은 ${allowed.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return value as T[number];
}

export function enumArray<const T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
  options: { allowEmpty?: boolean } = {},
): T[number][] {
  if (!Array.isArray(value)) {
    throw badRequest(`${field} 값은 배열이어야 합니다.`);
  }
  if (options.allowEmpty === false && value.length === 0) {
    throw badRequest(`${field} 값은 하나 이상 선택해야 합니다.`);
  }
  const normalized = value.map((item) =>
    enumValue(item, field, allowed),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw badRequest(`${field} 값에는 중복 항목을 넣을 수 없습니다.`);
  }
  return normalized;
}
