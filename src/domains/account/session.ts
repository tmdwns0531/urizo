/**
 * 세션 토큰. 서버에 세션 표를 두지 않고 서명한 값 자체로 신원을 증명한다.
 *
 * Web Crypto 를 쓴다. 이 앱은 node 와 workerd 양쪽에서 도는데
 * (`prisma-workerd`, `prisma-node` 두 클라이언트를 만든다) `node:crypto` 는
 * workerd 에서 보장되지 않는다.
 *
 * 담는 것은 계정 id 와 만료 시각뿐이다. 닉네임까지 넣으면 바꿨을 때 토큰이
 * 옛 이름을 들고 다닌다.
 */

const ENCODER = new TextEncoder();

/** 30 일. 찜 목록을 보려고 매번 다시 로그인하게 만들 이유가 없다. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const SESSION_COOKIE_NAME = "ott_damoa_session";

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** 서명을 URL 에 넣어도 되는 문자로 바꾼다. */
function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** `ArrayBuffer` 로 못박는다. Web Crypto 의 `BufferSource` 가 그것만 받는다. */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function createSessionToken(
  accountId: string,
  secret: string,
  now: Date,
): Promise<string> {
  const expiresAt = Math.floor(now.getTime() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${accountId}.${expiresAt}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    ENCODER.encode(payload),
  );
  return `${payload}.${toBase64Url(signature)}`;
}

/**
 * 서명과 만료를 함께 확인한다. 둘 중 하나라도 어긋나면 null 이다 — 왜 실패했는지
 * 구분해서 알려주면 토큰을 만들어 보는 쪽에 정보를 주게 된다.
 */
export async function readSessionToken(
  token: string,
  secret: string,
  now: Date,
): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [accountId, expiresRaw, signature] = parts;
  if (!accountId || !expiresRaw || !signature) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt)) return null;
  if (expiresAt * 1000 <= now.getTime()) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      ENCODER.encode(`${accountId}.${expiresAt}`),
    );
  } catch {
    // 서명이 base64 로도 안 읽히는 값이면 위조로 본다.
    return null;
  }
  return valid ? accountId : null;
}

/**
 * 서명 키를 정한다.
 *
 * live 는 `SESSION_SECRET` 이 반드시 있어야 하고 없으면 던진다. 없을 때 기본값을
 * 쓰면 그 값이 저장소에 공개되어 누구나 남의 세션을 위조할 수 있다. 뜨지 않는
 * 편이 조용히 뚫려 있는 것보다 낫다.
 *
 * demo 는 `.env.local` 없이도 떠야 하므로 프로세스마다 무작위로 만든다. 서버를
 * 다시 켜면 로그인이 풀리지만 데모용이라 문제가 없고, 상수와 달리 위조할 수
 * 없다.
 */
/**
 * 모듈 변수가 아니라 `globalThis` 에 둔다. 이 모듈이 두 벌 로드되면 (번들 분리,
 * 테스트 하네스 등) 키가 갈려서, 서명한 쪽과 검증하는 쪽이 서로 다른 키를 쓴다.
 * 그러면 방금 로그인한 사람이 다음 요청에서 로그인하지 않은 것으로 보인다.
 */
type SessionGlobal = typeof globalThis & { __ottDamoaDemoSessionSecret?: string };

export function resolveSessionSecret(
  profile: "demo" | "live",
  configured: string | undefined,
): string {
  const trimmed = configured?.trim();
  if (trimmed) return trimmed;
  if (profile === "live") {
    throw new Error(
      "SESSION_SECRET is required when APP_PROFILE=live; refusing to sign sessions with a shared default.",
    );
  }
  const scope = globalThis as SessionGlobal;
  if (!scope.__ottDamoaDemoSessionSecret) {
    scope.__ottDamoaDemoSessionSecret = toBase64Url(
      crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer,
    );
  }
  return scope.__ottDamoaDemoSessionSecret;
}
