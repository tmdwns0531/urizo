import type { AuthAdapter, ProfileRepository } from "../../contracts/ports";
import type { UserContext } from "../../contracts/user";
import {
  DEMO_ADULT_USER,
  DEMO_USERS,
} from "../../demo/fixtures/users";

export class DemoAuthAdapter implements AuthAdapter {
  constructor(private readonly profiles: ProfileRepository) {}

  async getUser(userId = DEMO_ADULT_USER.id): Promise<UserContext> {
    const stored = await this.profiles.get(userId);
    if (stored) {
      return stored;
    }

    const fixture = DEMO_USERS.find((user) => user.id === userId);
    if (!fixture) {
      throw new Error(`Unknown demo user "${userId}".`);
    }
    return this.profiles.save(fixture);
  }
}
