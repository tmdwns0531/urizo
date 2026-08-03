/**
 * 가입 입력 검증. SNS OAuth 는 범위 밖이라 별명·비밀번호·생년월일을 받는다.
 *
 * 별명이 계정을 찾는 열쇠이므로 비밀번호가 반드시 있어야 한다. 없으면 남의
 * 별명을 입력하는 것만으로 그 사람의 찜 목록에 들어간다.
 */

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
/**
 * 4 자. 복잡도 규칙(대문자·기호 강제)이나 흔한 비밀번호 차단은 두지 않는다.
 *
 * 이 계정이 담는 것은 찜 목록뿐이고, 결제 수단도 개인 식별 정보도 없다. 그
 * 무게에 맞는 최소한만 요구한다. 저장은 여전히 PBKDF2 로 해싱하므로, 값이
 * 짧아도 평문이 남거나 무지개표로 한 번에 뚫리지는 않는다.
 */
export const PASSWORD_MIN = 4;
/** PBKDF2 는 길이 제한이 없지만, 무한정 긴 입력은 연산 비용 공격이 된다. */
export const PASSWORD_MAX = 72;

/** 사람이 읽는 실패 사유. 화면에 그대로 띄운다. */
export type SignupProblem =
  | "NICKNAME_LENGTH"
  | "NICKNAME_CHARSET"
  | "PASSWORD_LENGTH"
  | "BIRTH_DATE_FORMAT"
  | "BIRTH_DATE_RANGE";

export interface SignupInput {
  nickname: string;
  password: string;
  birthDate: string;
}

export type SignupValidation =
  | { ok: true; value: SignupInput }
  | { ok: false; problems: SignupProblem[] };

/**
 * 한글·영문·숫자만 받는다. 공백과 기호를 막는 이유는 닉네임이 계정을 찾는
 * 열쇠여서, 눈으로 구분되지 않는 이름(앞뒤 공백, 전각 문자)이 서로 다른
 * 계정이 되면 사용자가 자기 목록을 잃기 때문이다.
 */
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]+$/;
const BIRTH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 달력에 없는 날짜(2 월 30 일 등)를 걸러낸다. */
function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateSignup(
  input: SignupInput,
  today: Date,
): SignupValidation {
  const nickname = input.nickname.trim();
  const birthDate = input.birthDate.trim();
  // 비밀번호는 다듬지 않는다. 앞뒤 공백도 사용자가 정한 값의 일부다.
  const password = input.password;
  const problems: SignupProblem[] = [];

  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    problems.push("NICKNAME_LENGTH");
  } else if (!NICKNAME_PATTERN.test(nickname)) {
    problems.push("NICKNAME_CHARSET");
  }

  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    problems.push("PASSWORD_LENGTH");
  }

  const match = BIRTH_DATE_PATTERN.exec(birthDate);
  if (!match) {
    problems.push("BIRTH_DATE_FORMAT");
  } else {
    const [year, month, day] = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    ];
    if (!isRealDate(year, month, day)) {
      problems.push("BIRTH_DATE_FORMAT");
    } else {
      const birth = new Date(Date.UTC(year, month - 1, day));
      // 미래이거나 사람이 살 수 없는 과거는 오타로 본다.
      const oldest = new Date(today);
      oldest.setUTCFullYear(oldest.getUTCFullYear() - 120);
      if (birth.getTime() > today.getTime() || birth.getTime() < oldest.getTime()) {
        problems.push("BIRTH_DATE_RANGE");
      }
    }
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { nickname, password, birthDate } };
}

/** 만 나이. 생일이 지났는지까지 따진다. */
export function ageOn(birthDate: string, today: Date): number {
  const match = BIRTH_DATE_PATTERN.exec(birthDate);
  if (!match) return 0;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  let age = today.getUTCFullYear() - year;
  const monthNow = today.getUTCMonth() + 1;
  const dayNow = today.getUTCDate();
  if (monthNow < month || (monthNow === month && dayNow < day)) age -= 1;
  return Math.max(0, age);
}

export const SIGNUP_PROBLEM_MESSAGES: Readonly<Record<SignupProblem, string>> = {
  NICKNAME_LENGTH: `별명은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 적어주세요.`,
  NICKNAME_CHARSET: "별명은 한글·영문·숫자만 쓸 수 있어요.",
  PASSWORD_LENGTH: `비밀번호는 ${PASSWORD_MIN}자 이상으로 적어주세요.`,
  BIRTH_DATE_FORMAT: "생년월일을 YYYY-MM-DD 형식으로 적어주세요.",
  BIRTH_DATE_RANGE: "생년월일을 다시 확인해 주세요.",
};
