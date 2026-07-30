import type { BudgetCounter } from "../budget";

export interface RegisteredTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  execute(input: TInput): Promise<TOutput>;
}

export interface ToolDescriptor {
  readonly name: string;
  readonly description: string;
}

export interface ToolFacade {
  list(): readonly ToolDescriptor[];
  execute<TOutput>(name: string, input: unknown): Promise<TOutput>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register<TInput, TOutput>(
    tool: RegisteredTool<TInput, TOutput>,
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool as RegisteredTool);
  }

  list(): readonly ToolDescriptor[] {
    return Object.freeze(
      [...this.tools.values()].map(({ name, description }) =>
        Object.freeze({ name, description }),
      ),
    );
  }

  bind(budget: BudgetCounter): ToolFacade {
    return Object.freeze({
      list: (): readonly ToolDescriptor[] => this.list(),
      execute: <TOutput>(
        name: string,
        input: unknown,
      ): Promise<TOutput> => this.executeBound(name, input, budget),
    });
  }

  private async executeBound<TOutput>(
    name: string,
    input: unknown,
    budget: BudgetCounter,
  ): Promise<TOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered.`);
    }
    return budget.runTool(async () =>
      (await tool.execute(input)) as TOutput,
    );
  }
}