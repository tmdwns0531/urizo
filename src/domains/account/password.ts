/**
 * 비밀번호 저장. 평문도 단순 해시도 두지 않는다.
 *
 * PBKDF2-HMAC-SHA256 을 쓴다. bcrypt·argon2 가 더 낫지만 둘 다 네이티브 모듈이
 * 필요한데, 이 앱은 node 와 workerd 양쪽에서 돌아야 해서 쓸 수 없다. Web Crypto
 * 의 PBKDF2 는 양쪽 모두 지원한다.
 *
 * 저장 형식: `pbkdf2$<반복수>$<salt>$<hash>` — 반복수를 함께 적어둬서, 나중에
 * 값을 올려도 옛 비밀번호를 계속 확인할 수 있다.
 */

const ENCODER = new TextEncoder();

/**
 * OWASP 는 PBKDF2-SHA256 에 600,000 회를 권한다. 여기서 210,000 을 쓰는 이유는
 * workerd 의 요청당 CPU 예산 때문이다 — 600,000 회는 로그인 한 번에 그 예산을
 * 넘겨 요청이 끊긴다. 210,000 은 예전 OWASP 권고치이고, 이 앱이 담는 것이 찜
 * 목록뿐이라는 점을 함께 놓고 택한 값이다. 실행 환경이 node 로 고정되면 올린다.
 */
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const toBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

/**
 * `ArrayBuffer` 로 못박아 만든다. `Uint8Array.from` 이 주는
 * `Uint8Array<ArrayBufferLike>` 는 Web Crypto 의 `BufferSource` 로 안 받아준다.
 */
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(
    new Uint8Array(new ArrayBuffer(SALT_BYTES)),
  );
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * 길이가 같은 두 바이트열을 끝까지 비교한다. 처음 다른 자리에서 멈추면 걸린
 * 시간으로 몇 글자까지 맞았는지 새어 나간다.
 */
function equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations <= 0) return false;
  try {
    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    const actual = await derive(password, salt, iterations);
    return equals(actual, expected);
  } catch {
    // 저장 값이 깨졌으면 로그인 실패로 처리한다.
    return false;
  }
}
