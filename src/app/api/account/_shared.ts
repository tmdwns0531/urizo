import { withAccountComposition } from "@/composition/account";
import type { Account, PublicAccount } from "@/contracts/account";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  readSessionToken,
} from "@/domains/account/session";

/**
 * 계정 API 전용 응답 헬퍼.
 *
 * `api/_shared/http.ts` 를 쓰지 않는 이유는 그쪽 `PublicErrorCode` 가 추천 흐름의
 * 공용 계약이라, 로그인 때문에 401·409 를 밀어 넣으면 그 계약을 쓰는 모든
 * 소비자가 영향을 받기 때문이다. 계정은 새로 붙는 표면이라 자기 코드를 갖는다.
 */
export type AccountErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NICKNAME_TAKEN"
  | "INVALID_CREDENTIALS"
  | "INTERNAL_ERROR";

const STATUS: Record<AccountErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NICKNAME_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  INTERNAL_ERROR: 500,
};

export function fail(
  code: AccountErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json(
    { error: message, code, ...extra },
    { status: STATUS[code] },
  );
}

/**
 * 사용자에게는 일반 문구를 주고 원인은 서버 로그에만 남긴다. 삼켜버리면 장애가
 * 나도 무엇이 터졌는지 알 수 없다.
 *
 * 로그에는 오류의 이름과 메시지만 적는다. 스택이나 입력값을 그대로 흘리면
 * 별명·비밀번호가 로그로 새어 나간다.
 */
export function logServerError(where: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({ event: "ACCOUNT_API_ERROR", where, name, message }),
  );
}

export const ok = (body: unknown, init: ResponseInit = {}): Response =>
  Response.json(body, init);

export const toPublicAccount = (account: Account): PublicAccount => ({
  id: account.id,
  nickname: account.nickname,
});

/** 요청 본문이 커지는 것을 막는다. 계정 입력은 몇백 바이트면 충분하다. */
const MAX_BODY_BYTES = 4_096;

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const readString = (
  body: Record<string, unknown>,
  key: string,
): string => (typeof body[key] === "string" ? (body[key] as string) : "");

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey.trim() === name) return decodeURIComponent(rest.join("=").trim());
  }
  return null;
}

/**
 * `HttpOnly` 로 심어 스크립트가 못 읽게 하고, `SameSite=Lax` 로 다른 사이트에서
 * 온 요청에는 안 붙게 한다. live 는 HTTPS 이므로 `Secure` 를 붙이고, demo 는
 * `http://localhost` 로도 떠야 해서 붙이지 않는다.
 */
export function sessionCookie(
  token: string,
  profile: "demo" | "live",
): string {
  const flags = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (profile === "live") flags.push("Secure");
  return flags.join("; ");
}

export function clearedSessionCookie(profile: "demo" | "live"): string {
  const flags = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (profile === "live") flags.push("Secure");
  return flags.join("; ");
}

/** 쿠키의 세션을 계정으로 바꾼다. 없거나 못 믿을 값이면 null 이다. */
export async function currentAccount(
  request: Request,
): Promise<Account | null> {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;
  return withAccountComposition(async ({ accounts, sessionSecret }) => {
    const accountId = await readSessionToken(token, sessionSecret, new Date());
    if (!accountId) return null;
    // 토큰은 멀쩡한데 계정이 지워졌을 수 있다.
    return accounts.findById(accountId);
  });
}
