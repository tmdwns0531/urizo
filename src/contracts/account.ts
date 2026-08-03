/**
 * 계정과 찜 목록의 공개 계약.
 *
 * 익명 추천 흐름은 이 계약을 쓰지 않는다. 로그인은 찜 목록에만 필요하고,
 * 추천 자격 판정(`getMvpFilterReasons`)은 지금처럼 계정과 무관하게 남는다.
 * 로그인한 사람에게 관람등급을 더 열어주는 일은 이 계약의 범위가 아니다.
 */

/** 저장·전송에 쓰는 계정. 비밀번호 해시 같은 내부 값은 담지 않는다. */
export interface Account {
  id: string;
  nickname: string;
  /** `YYYY-MM-DD`. 나이 계산에만 쓰고 화면에는 내보내지 않는다. */
  birthDate: string;
  createdAt: string;
}

/** 화면에 내려보내는 형태. 생년월일은 개인정보라 빼고 보낸다. */
export interface PublicAccount {
  id: string;
  nickname: string;
}

export interface WatchlistItem {
  contentId: string;
  savedAt: string;
}

/**
 * 비밀번호 해시를 함께 들고 있는 내부 형태. 이 타입은 저장소와 인증 경로
 * 밖으로 나가면 안 된다.
 */
export interface AccountWithSecret extends Account {
  passwordHash: string;
}

export interface AccountRepository {
  /** 별명은 계정을 찾는 열쇠다. 이미 쓰는 별명이면 null 을 돌려준다. */
  createAccount(input: {
    nickname: string;
    passwordHash: string;
    birthDate: string;
  }): Promise<Account | null>;
  /** 로그인 확인용. 해시를 함께 준다. */
  findByNicknameWithSecret(nickname: string): Promise<AccountWithSecret | null>;
  findById(id: string): Promise<Account | null>;
}

export interface WatchlistRepository {
  list(accountId: string): Promise<WatchlistItem[]>;
  /** 이미 담긴 작품을 다시 담아도 오류가 아니다. 저장 시각만 유지한다. */
  add(accountId: string, contentId: string): Promise<void>;
  remove(accountId: string, contentId: string): Promise<void>;
  clear(accountId: string): Promise<void>;
}
