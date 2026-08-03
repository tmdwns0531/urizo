import { withAccountComposition } from "@/composition/account";
import { hashPassword } from "@/domains/account/password";
import { createSessionToken } from "@/domains/account/session";
import {
  SIGNUP_PROBLEM_MESSAGES,
  validateSignup,
} from "@/domains/account/signup";
import {
  fail,
  logServerError,
  ok,
  readJsonObject,
  readString,
  sessionCookie,
  toPublicAccount,
} from "../_shared";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    if (!body) return fail("BAD_REQUEST", "요청을 읽지 못했어요.");

    const validation = validateSignup(
      {
        nickname: readString(body, "nickname"),
        password: readString(body, "password"),
        birthDate: readString(body, "birthDate"),
      },
      new Date(),
    );
    if (!validation.ok) {
      return fail(
        "BAD_REQUEST",
        SIGNUP_PROBLEM_MESSAGES[validation.problems[0]],
        { problems: validation.problems },
      );
    }

    // 해싱은 검증을 통과한 뒤에 한다. 먼저 하면 형식만 틀린 요청에도 비싼
    // 연산이 돌아 그 자체가 부하 수단이 된다.
    const passwordHash = await hashPassword(validation.value.password);

    return await withAccountComposition(
      async ({ accounts, sessionSecret, profile }) => {
        const account = await accounts.createAccount({
          nickname: validation.value.nickname,
          passwordHash,
          birthDate: validation.value.birthDate,
        });
        if (!account) {
          return fail("NICKNAME_TAKEN", "이미 쓰고 있는 별명이에요.");
        }
        const token = await createSessionToken(
          account.id,
          sessionSecret,
          new Date(),
        );
        return ok(
          { account: toPublicAccount(account) },
          {
            status: 201,
            headers: { "set-cookie": sessionCookie(token, profile) },
          },
        );
      },
    );
  } catch (error) {
    logServerError("signup.POST", error);
    return fail("INTERNAL_ERROR", "가입을 마치지 못했어요.");
  }
}
