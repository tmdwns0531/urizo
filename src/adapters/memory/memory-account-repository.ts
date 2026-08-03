import type {
  Account,
  AccountRepository,
  AccountWithSecret,
  WatchlistItem,
  WatchlistRepository,
} from "../../contracts/account";
import { createId } from "../shared/id";

/**
 * demo 프로필용. DB 없이 떠야 하는 요구를 지키기 위한 것이지, 인증을 느슨하게
 * 하려는 것이 아니다 — 비밀번호 해시 확인과 세션 서명은 live 와 같은 코드를
 * 지난다. 여기서는 저장 위치만 프로세스 메모리다.
 *
 * 서버를 다시 켜면 계정이 사라진다. demo 는 고정 데이터를 보여주는 용도라
 * 문제가 되지 않는다.
 */
export class MemoryAccountRepository implements AccountRepository {
  private readonly byId = new Map<string, AccountWithSecret>();
  private readonly idByNickname = new Map<string, string>();

  async createAccount(input: {
    nickname: string;
    passwordHash: string;
    birthDate: string;
  }): Promise<Account | null> {
    if (this.idByNickname.has(input.nickname)) return null;
    const account: AccountWithSecret = {
      id: createId("acc"),
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      birthDate: input.birthDate,
      createdAt: new Date().toISOString(),
    };
    this.byId.set(account.id, account);
    this.idByNickname.set(account.nickname, account.id);
    return strip(account);
  }

  async findByNicknameWithSecret(
    nickname: string,
  ): Promise<AccountWithSecret | null> {
    const id = this.idByNickname.get(nickname);
    const account = id ? this.byId.get(id) : undefined;
    return account ? { ...account } : null;
  }

  async findById(id: string): Promise<Account | null> {
    const account = this.byId.get(id);
    return account ? strip(account) : null;
  }
}

/** 해시는 저장소 밖으로 흘리지 않는다. */
const strip = (account: AccountWithSecret): Account => ({
  id: account.id,
  nickname: account.nickname,
  birthDate: account.birthDate,
  createdAt: account.createdAt,
});

export class MemoryWatchlistRepository implements WatchlistRepository {
  private readonly byAccount = new Map<string, Map<string, string>>();

  async list(accountId: string): Promise<WatchlistItem[]> {
    const saved = this.byAccount.get(accountId);
    if (!saved) return [];
    return [...saved.entries()]
      .map(([contentId, savedAt]) => ({ contentId, savedAt }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async add(accountId: string, contentId: string): Promise<void> {
    const saved = this.byAccount.get(accountId) ?? new Map<string, string>();
    // 이미 담긴 작품이면 저장 시각을 그대로 둔다. live 의 upsert 와 같은 규칙이다.
    if (!saved.has(contentId)) saved.set(contentId, new Date().toISOString());
    this.byAccount.set(accountId, saved);
  }

  async remove(accountId: string, contentId: string): Promise<void> {
    this.byAccount.get(accountId)?.delete(contentId);
  }

  async clear(accountId: string): Promise<void> {
    this.byAccount.delete(accountId);
  }
}
