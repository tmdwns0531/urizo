import type { BudgetSnapshot } from "../../contracts/mvp-recommendation";

export interface BudgetLimits {
  modelCalls: number;
  toolCalls: number;
  tokens: number;
  elapsedMs: number;
}

export type { BudgetSnapshot };

export class BudgetExceededError extends Error {
  readonly snapshot: BudgetSnapshot;

  constructor(message: string, snapshot: BudgetSnapshot) {
    super(message);
    this.name = "BudgetExceededError";
    this.snapshot = snapshot;
  }
}

export class BudgetCounter {
  private modelCalls = 0;
  private toolCalls = 0;
  private tokens = 0;
  private readonly startedAt: number;

  constructor(
    private readonly limits: BudgetLimits,
    private readonly now: () => number = Date.now,
  ) {
    for (const [name, value] of Object.entries(limits)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`Budget limit ${name} must be non-negative.`);
      }
    }
    this.startedAt = this.now();
  }

  consumeModel(tokens = 0): void {
    this.modelCalls += 1;
    this.addTokens(tokens);
    this.assertWithinLimits();
  }

  consumeTool(): void {
    this.toolCalls += 1;
    this.assertWithinLimits();
  }

  consumeTokens(tokens: number): void {
    this.addTokens(tokens);
    this.assertWithinLimits();
  }

  async runModel<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    readTokenUsage: (result: T) => number = () => 0,
    readErrorTokenUsage: (error: unknown) => number = () => 0,
  ): Promise<T> {
    this.consumeModel();

    try {
      const result = await this.runWithinDeadline(
        operation,
        "Recommendation model execution exceeded its deadline.",
      );
      this.consumeTokens(readTokenUsage(result));
      return result;
    } catch (error) {
      const errorTokens = this.normalizeCount(readErrorTokenUsage(error));
      if (errorTokens > 0) {
        this.consumeTokens(errorTokens);
      }
      throw error;
    }
  }

  async runTool<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    this.consumeTool();
    return this.runWithinDeadline(
      operation,
      "Recommendation tool execution exceeded its deadline.",
    );
  }

  private async runWithinDeadline<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMessage: string,
  ): Promise<T> {
    const remainingMs = this.limits.elapsedMs - this.snapshot().elapsedMs;
    if (remainingMs <= 0) {
      throw new BudgetExceededError(timeoutMessage, this.snapshot());
    }

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        Promise.resolve().then(() => operation(controller.signal)),
        new Promise<T>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            const error = new BudgetExceededError(
              timeoutMessage,
              this.snapshot(),
            );
            reject(error);
            controller.abort(error);
          }, remainingMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private addTokens(tokens: number): void {
    this.tokens += this.normalizeCount(tokens);
  }

  private normalizeCount(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }
    return Math.floor(value);
  }

  assertWithinLimits(): void {
    const snapshot = this.snapshot();
    if (
      snapshot.modelCalls > this.limits.modelCalls ||
      snapshot.toolCalls > this.limits.toolCalls ||
      snapshot.tokens > this.limits.tokens ||
      snapshot.elapsedMs > this.limits.elapsedMs
    ) {
      throw new BudgetExceededError(
        "Recommendation execution exceeded its configured budget.",
        snapshot,
      );
    }
  }

  snapshot(): BudgetSnapshot {
    return {
      modelCalls: this.modelCalls,
      toolCalls: this.toolCalls,
      tokens: this.tokens,
      elapsedMs: Math.max(0, this.now() - this.startedAt),
    };
  }
}
