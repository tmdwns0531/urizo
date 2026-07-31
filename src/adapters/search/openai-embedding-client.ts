import {
  OPENAI_QUERY_VECTOR_ALGORITHM,
  OPENAI_QUERY_VECTOR_DIMENSIONS,
  OPENAI_QUERY_VECTOR_MODEL,
  type OpenAiQueryVectorSnapshot,
} from "../../contracts/mvp-search";
import { parseQueryVectorSnapshot } from "../../domains/search/semantic";

export type EmbeddingFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAiEmbeddingResult extends OpenAiQueryVectorSnapshot {
  tokenUsage: number;
}

export interface OpenAiEmbeddingClientPort {
  embed(input: string, signal?: AbortSignal): Promise<OpenAiEmbeddingResult>;
}

export interface OpenAiEmbeddingClientOptions {
  apiKey: string;
  fetch?: EmbeddingFetch;
  endpoint?: string;
  model?: typeof OPENAI_QUERY_VECTOR_MODEL;
  dimensions?: typeof OPENAI_QUERY_VECTOR_DIMENSIONS;
}

export class OpenAiEmbeddingError extends Error {
  readonly name = "OpenAiEmbeddingError";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function normalizeTokenUsage(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function readEmbeddingTokenUsage(payload: Record<string, unknown>): number {
  if (!isRecord(payload.usage)) return 0;
  const total = normalizeTokenUsage(payload.usage.total_tokens);
  return total > 0
    ? total
    : normalizeTokenUsage(payload.usage.prompt_tokens);
}

/**
 * Worker-compatible embeddings client. Credentials and fetch are injected at
 * composition time; this module never reads environment variables or logs a
 * request/response body.
 */
export class OpenAiEmbeddingClient implements OpenAiEmbeddingClientPort {
  private readonly apiKey: string;
  private readonly fetchImpl: EmbeddingFetch;
  private readonly endpoint: string;

  constructor(options: OpenAiEmbeddingClientOptions) {
    if (!options.apiKey.trim()) {
      throw new OpenAiEmbeddingError("OpenAI API key is required");
    }
    if (
      options.model !== undefined &&
      options.model !== OPENAI_QUERY_VECTOR_MODEL
    ) {
      throw new OpenAiEmbeddingError(
        `embedding model must be ${OPENAI_QUERY_VECTOR_MODEL}`,
      );
    }
    if (
      options.dimensions !== undefined &&
      options.dimensions !== OPENAI_QUERY_VECTOR_DIMENSIONS
    ) {
      throw new OpenAiEmbeddingError(
        `embedding dimensions must be ${OPENAI_QUERY_VECTOR_DIMENSIONS}`,
      );
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new OpenAiEmbeddingError("Fetch implementation is required");
    }
    this.apiKey = options.apiKey;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.endpoint =
      options.endpoint?.replace(/\/$/, "") ??
      "https://api.openai.com/v1/embeddings";
  }

  async embed(
    input: string,
    signal?: AbortSignal,
  ): Promise<OpenAiEmbeddingResult> {
    if (typeof input !== "string" || !input.trim()) {
      throw new OpenAiEmbeddingError("embedding input must not be empty");
    }

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_QUERY_VECTOR_MODEL,
          input,
          dimensions: OPENAI_QUERY_VECTOR_DIMENSIONS,
          encoding_format: "float",
        }),
        signal,
      });
    } catch {
      throw new OpenAiEmbeddingError("OpenAI embeddings request failed");
    }

    if (!response.ok) {
      throw new OpenAiEmbeddingError(
        `OpenAI embeddings request failed with status ${response.status}`,
      );
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new OpenAiEmbeddingError("OpenAI embeddings response is malformed");
    }
    const first = payload.data[0];
    if (!isRecord(first) || !Array.isArray(first.embedding)) {
      throw new OpenAiEmbeddingError("OpenAI embedding vector is missing");
    }

    const parsed = parseQueryVectorSnapshot({
      algorithm: OPENAI_QUERY_VECTOR_ALGORITHM,
      version: 1,
      dimensions: OPENAI_QUERY_VECTOR_DIMENSIONS,
      values: first.embedding,
    });
    if (parsed.algorithm !== OPENAI_QUERY_VECTOR_ALGORITHM) {
      throw new OpenAiEmbeddingError("OpenAI embedding algorithm mismatch");
    }
    return {
      ...parsed,
      tokenUsage: readEmbeddingTokenUsage(payload),
    };
  }
}
