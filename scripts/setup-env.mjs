import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export const SESSION_SECRET_KEY = "SESSION_SECRET";

/**
 * 세션 서명 키. 추측할 수 있으면 남의 로그인을 위조할 수 있으므로 사람이 고른
 * 문자열이 아니라 난수를 쓴다. base64url 로 적어야 `.env` 한 줄에 그대로 들어간다.
 */
export const generateSessionSecret = () => randomBytes(32).toString("base64url");

/** 파일이 이미 쓰는 줄바꿈을 따라간다. 섞어 쓰면 diff 가 통째로 뒤집힌다. */
function detectEol(contents) {
  return contents.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * `SESSION_SECRET` 을 채운 내용을 돌려준다. 원본은 바꾸지 않는다.
 *
 * 이미 값이 있으면 절대 건드리지 않는다 — 이 파일에는 각자의 DB 자격증명이 들어
 * 있어서, 덮어쓰면 되돌릴 방법이 없다. 값을 바꾸고 싶은 사람은 직접 고치면 된다.
 *
 * 반환하는 `outcome` 은 `already-set` · `filled` · `appended` 중 하나다.
 */
export function applySessionSecret(contents, secret) {
  const eol = detectEol(contents);
  const prefix = `${SESSION_SECRET_KEY}=`;
  const lines = contents.split(/\r?\n/);
  // 주석(`# SESSION_SECRET=...`)은 설정이 아니므로 줄 맨 앞만 본다.
  const index = lines.findIndex((line) => line.startsWith(prefix));

  if (index === -1) {
    const needsEol = contents.length > 0 && !contents.endsWith("\n");
    const body = needsEol ? contents + eol : contents;
    return {
      contents: `${body}${prefix}${secret}${eol}`,
      outcome: "appended",
    };
  }

  if (lines[index].slice(prefix.length).trim()) {
    return { contents, outcome: "already-set" };
  }

  lines[index] = `${prefix}${secret}`;
  return { contents: lines.join(eol), outcome: "filled" };
}

/**
 * 생성한 값은 화면에 찍지 않는다. 터미널 기록과 화면 공유로 그대로 새어 나가는데,
 * 사람이 그 값을 볼 이유는 없다 — 필요하면 `.env.local` 을 열면 된다.
 */
async function main() {
  const examplePath = path.join(projectRoot, ".env.example");
  const localPath = path.join(projectRoot, ".env.local");
  const hadLocalFile = existsSync(localPath);

  if (!hadLocalFile && !existsSync(examplePath)) {
    throw new Error(".env.example 을 찾지 못해 .env.local 을 만들 수 없습니다.");
  }

  const source = hadLocalFile ? localPath : examplePath;
  const { contents, outcome } = applySessionSecret(
    await readFile(source, "utf8"),
    generateSessionSecret(),
  );

  if (outcome === "already-set") {
    console.log(
      ".env.local 에 SESSION_SECRET 이 이미 있습니다. 아무것도 바꾸지 않았습니다.",
    );
    return;
  }

  await writeFile(localPath, contents, "utf8");

  if (hadLocalFile) {
    console.log(
      "SESSION_SECRET 을 새로 만들어 .env.local 에 넣었습니다. 다른 줄은 그대로입니다.",
    );
  } else {
    console.log(
      ".env.example 을 복사해 .env.local 을 만들고 SESSION_SECRET 을 채웠습니다.",
    );
    console.log(
      "LIVE 로 실행하려면 DATABASE_URL 등 나머지 값을 직접 채워야 합니다.",
    );
  }
  console.log("실행 중인 서버가 있다면 다시 켜야 반영됩니다.");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
