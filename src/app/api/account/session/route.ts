import { withAccountComposition } from "@/composition/account";
import { hashPassword, verifyPassword } from "@/domains/account/password";
import { createSessionToken } from "@/domains/account/session";
import {
  clearedSessionCookie,
  currentAccount,
  fail,
  logServerError,
  ok,
  readJsonObject,
  readString,
  sessionCookie,
  toPublicAccount,
} from "../_shared";

/** 지금 로그인한 사람. 로그인하지 않았어도 오류가 아니다. */
export async function GET(request: Request): Promise<Response> {
  try {
    const account = await currentAccount(request);
    return ok({ account: account ? toPublicAccount(account) : null });
  } catch (error) {
    logServerError("session.GET", error);
    return fail("INTERNAL_ERROR", "로그인 상태를 확인하지 못했어요.");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    if (!body) return fail("BAD_REQUEST", "요청을 읽지 못했어요.");

    const nickname = readString(body, "nickname").trim();
    const password = readString(body, "password");
    if (!nickname || !password) {
      return fail("BAD_REQUEST", "별명과 비밀번호를 모두 적어주세요.");
    }

    return await withAccountComposition(
      async ({ accounts, sessionSecret, profile }) => {
        const found = await accounts.findByNicknameWithSecret(nickname);

        /**
         * 없는 별명이어도 해싱을 한 번 돌린다. 바로 실패로 답하면 응답이 빠른
         * 것만으로 그 별명이 없다는 사실이 새어 나가, 가입된 별명을 훑을 수 있다.
         */
        if (!found) {
          await hashPassword(password);
          return fail("INVALID_CREDENTIALS", "별명이나 비밀번호가 달라요.");
        }

        const valid = await verifyPassword(password, found.passwordHash);
        if (!valid) {
          return fail("INVALID_CREDENTIALS", "별명이나 비밀번호가 달라요.");
        }

        const token = await createSessionToken(
          found.id,
          sessionSecret,
          new Date(),
        );
        return ok(
          { account: toPublicAccount(found) },
          { headers: { "set-cookie": sessionCookie(token, profile) } },
        );
      },
    );
  } catch (error) {
    logServerError("session.POST", error);
    return fail("INTERNAL_ERROR", "로그인하지 못했어요.");
  }
}

export async function DELETE(): Promise<Response> {
  try {
    return await withAccountComposition(async ({ profile }) =>
      ok(
        { account: null },
        { headers: { "set-cookie": clearedSessionCookie(profile) } },
      ),
    );
  } catch (error) {
    logServerError("session.DELETE", error);
    return fail("INTERNAL_ERROR", "로그아웃하지 못했어요.");
  }
}
