export interface BudgetLimits {
  modelCalls: number;
  toolCalls: number;
  tokens: number;
  elapsedMs: number;
}

export interface BudgetSnapshot {
  modelCalls: number;
  toolCalls: number;
  tokens: number;
  elapsedMs: number;
}

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
  private readonly startedAt = Date.now();

  constructor(private readonly limits: BudgetLimits) {}

  consumeModel(tokens = 0): void {
    this.modelCalls += 1;
    this.tokens += Math.max(0, tokens);
    this.assertWithinLimits();
  }

  consumeTool(): void {
    this.toolCalls += 1;
    this.assertWithinLimits();
  }

  async runTool<T>(operation: () => Promise<T>): Promise<T> {
    this.consumeTool();
    const remainingMs = Math.max(
      0,
      this.limits.elapsedMs - this.snapshot().elapsedMs,
    );
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise<T>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new BudgetExceededError(
                "Recommendation tool execution exceeded its deadline.",
                this.snapshot(),
              ),
            );
          }, remainingMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
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
      elapsedMs: Date.now() - this.startedAt,
    };
  }
}