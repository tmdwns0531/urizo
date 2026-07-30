import type { ProfileRepository } from "../../contracts/ports";
import type { UserContext, UserProfilePatch } from "../../contracts/user";
import { DEMO_USERS } from "../../demo/fixtures/users";
import { clone } from "./clone";

function ageFromBirthDate(birthDate: string, now = new Date()): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    throw new Error("birthDate must be a valid ISO date.");
  }
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() &&
      now.getDate() < birth.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}

export class MemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, UserContext>();

  constructor() {
    this.seed();
  }

  private seed(): void {
    for (const user of DEMO_USERS) {
      this.profiles.set(user.id, clone(user));
    }
  }

  async get(userId: string): Promise<UserContext | null> {
    const profile = this.profiles.get(userId);
    return profile ? clone(profile) : null;
  }

  async save(profile: UserContext): Promise<UserContext> {
    const stored = clone(profile);
    this.profiles.set(profile.id, stored);
    return clone(stored);
  }

  async update(
    userId: string,
    patch: UserProfilePatch,
  ): Promise<UserContext> {
    const current = this.profiles.get(userId);
    if (!current) {
      throw new Error(`Profile "${userId}" was not found.`);
    }
    const birthDate = patch.birthDate ?? current.birthDate;
    const age = ageFromBirthDate(birthDate);
    const updated: UserContext = {
      ...current,
      ...clone(patch),
      birthDate,
      age,
      isMinor: age < 19,
    };
    this.profiles.set(userId, updated);
    return clone(updated);
  }

  async clear(): Promise<void> {
    this.profiles.clear();
    this.seed();
  }
}
