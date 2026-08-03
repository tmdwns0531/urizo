import type {
  Account,
  AccountRepository,
  AccountWithSecret,
  WatchlistItem,
  WatchlistRepository,
} from "../../contracts/account";
import { createId } from "../shared/id";
import { PrismaRepositoryError } from "./types";

/**
 * 저장소가 실제로 쓰는 델리게이트만 좁게 적는다. 생성된 클라이언트 타입을
 * 그대로 받으면 node/workerd 두 클라이언트 중 하나에 묶인다.
 */
export interface PrismaAccountClient {
  account: {
    create(args: {
      data: {
        id: string;
        nickname: string;
        passwordHash: string;
        birthDate: Date;
      };
    }): Promise<PrismaAccountRecord>;
    findUnique(args: {
      where: { nickname: string } | { id: string };
    }): Promise<PrismaAccountRecord | null>;
  };
  watchlistItem: {
    findMany(args: {
      where: { accountId: string };
      orderBy: { savedAt: "desc" };
    }): Promise<PrismaWatchlistRecord[]>;
    upsert(args: {
      where: { accountId_contentId: { accountId: string; contentId: string } };
      create: { id: string; accountId: string; contentId: string };
      update: Record<string, never>;
    }): Promise<unknown>;
    deleteMany(args: {
      where: { accountId: string; contentId?: string };
    }): Promise<{ count: number }>;
  };
}

export interface PrismaAccountRecord {
  id: string;
  nickname: string;
  passwordHash: string;
  birthDate: Date;
  createdAt: Date;
}

export interface PrismaWatchlistRecord {
  contentId: string;
  savedAt: Date;
}

/** `YYYY-MM-DD`. 시간대에 흔들리지 않도록 UTC 로 읽는다. */
const toDateOnly = (value: Date): string =>
  value.toISOString().slice(0, 10);

const toAccount = (record: PrismaAccountRecord): Account => ({
  id: record.id,
  nickname: record.nickname,
  birthDate: toDateOnly(record.birthDate),
  createdAt: record.createdAt.toISOString(),
});

/**
 * 별명 중복은 오류가 아니라 "이미 쓰는 별명" 이라는 답이다. DB 의 unique 제약에
 * 맡기고 그때 null 로 바꾼다 — 먼저 조회하고 넣으면 두 요청이 동시에 들어올 때
 * 둘 다 통과한다.
 */
const isUniqueViolation = (error: unknown): boolean => {
  const code = (error as { code?: unknown })?.code;
  return code === "P2002";
};

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly client: PrismaAccountClient) {}

  async createAccount(input: {
    nickname: string;
    passwordHash: string;
    birthDate: string;
  }): Promise<Account | null> {
    try {
      const record = await this.client.account.create({
        data: {
          id: createId("acc"),
          nickname: input.nickname,
          passwordHash: input.passwordHash,
          birthDate: new Date(`${input.birthDate}T00:00:00.000Z`),
        },
      });
      return toAccount(record);
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw new PrismaRepositoryError("ACCOUNT_CREATE_FAILED");
    }
  }

  async findByNicknameWithSecret(
    nickname: string,
  ): Promise<AccountWithSecret | null> {
    try {
      const record = await this.client.account.findUnique({
        where: { nickname },
      });
      return record
        ? { ...toAccount(record), passwordHash: record.passwordHash }
        : null;
    } catch {
      throw new PrismaRepositoryError("ACCOUNT_LOOKUP_FAILED");
    }
  }

  async findById(id: string): Promise<Account | null> {
    try {
      const record = await this.client.account.findUnique({ where: { id } });
      return record ? toAccount(record) : null;
    } catch {
      throw new PrismaRepositoryError("ACCOUNT_LOOKUP_FAILED");
    }
  }
}

export class PrismaWatchlistRepository implements WatchlistRepository {
  constructor(private readonly client: PrismaAccountClient) {}

  async list(accountId: string): Promise<WatchlistItem[]> {
    try {
      const records = await this.client.watchlistItem.findMany({
        where: { accountId },
        orderBy: { savedAt: "desc" },
      });
      return records.map((record) => ({
        contentId: record.contentId,
        savedAt: record.savedAt.toISOString(),
      }));
    } catch {
      throw new PrismaRepositoryError("WATCHLIST_LIST_FAILED");
    }
  }

  async add(accountId: string, contentId: string): Promise<void> {
    try {
      // 이미 담긴 작품을 다시 담아도 오류가 아니고, 저장 시각도 그대로 둔다.
      await this.client.watchlistItem.upsert({
        where: { accountId_contentId: { accountId, contentId } },
        create: { id: createId("wl"), accountId, contentId },
        update: {},
      });
    } catch {
      throw new PrismaRepositoryError("WATCHLIST_ADD_FAILED");
    }
  }

  async remove(accountId: string, contentId: string): Promise<void> {
    try {
      await this.client.watchlistItem.deleteMany({
        where: { accountId, contentId },
      });
    } catch {
      throw new PrismaRepositoryError("WATCHLIST_REMOVE_FAILED");
    }
  }

  async clear(accountId: string): Promise<void> {
    try {
      await this.client.watchlistItem.deleteMany({ where: { accountId } });
    } catch {
      throw new PrismaRepositoryError("WATCHLIST_CLEAR_FAILED");
    }
  }
}
