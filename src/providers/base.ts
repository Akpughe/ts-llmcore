/**
 * Base provider interface for LLMCore package
 */

import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  StreamResponse,
  ProviderHealth,
  ModelsResponse,
  LLMCoreError,
  ProviderName,
  BaseProviderConfig,
} from "../types/index";

// Base provider interface that all adapters must implement
export interface BaseProvider {
  // Provider identification
  readonly name: string;
  readonly displayName: string;

  // Core functionality
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(
    request: ChatRequest
  ): Promise<StreamResponse<StreamingChatResponse>>;

  // Provider management
  isConfigured(): boolean;
  validateConfig(): Promise<boolean>;
  getHealth(): Promise<ProviderHealth>;
  getModels(): Promise<ModelsResponse>;

  // Utility methods
  estimateCost(request: ChatRequest): Promise<number>;
  validateRequest(request: ChatRequest): Promise<boolean>;
}

// Abstract base class with common functionality
export abstract class AbstractProvider implements BaseProvider {
  protected config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
  }

  // Abstract methods that must be implemented
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract chatStream(
    request: ChatRequest
  ): Promise<StreamResponse<StreamingChatResponse>>;
  abstract getModels(): Promise<ModelsResponse>;

  // Common implementations
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.getHealth();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Simple health check by calling models endpoint
      await this.getModels();
      const latency = Date.now() - startTime;

      return {
        status: "active",
        latency,
        lastCheck: new Date(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        status: "error",
        latency,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async estimateCost(request: ChatRequest): Promise<number> {
    // Basic cost estimation - to be overridden by providers
    const inputTokens = this.estimateTokens(
      request.messages.map((m) => m.content).join(" ")
    );
    const outputTokens = request.maxTokens || 150;

    // Default pricing (very rough estimate)
    const inputCostPerToken = 0.00001;
    const outputCostPerToken = 0.00003;

    return inputTokens * inputCostPerToken + outputTokens * outputCostPerToken;
  }

  async validateRequest(request: ChatRequest): Promise<boolean> {
    if (!request.messages || request.messages.length === 0) {
      return false;
    }

    if (!request.model || !request.provider) {
      return false;
    }

    return true;
  }

  // Helper methods
  protected estimateTokens(text: string): number {
    // Very rough token estimation (about 4 characters per token)
    return Math.ceil(text.length / 4);
  }

  protected createError(
    type: string,
    code: string,
    message: string,
    statusCode: number | undefined = undefined,
    details: Record<string, unknown> | undefined = undefined
  ): LLMCoreError {
    const error: LLMCoreError = {
      name: "LLMCoreError",
      type: type as any,
      code,
      message,
      provider: this.name as ProviderName,
      retryable: statusCode ? statusCode >= 500 || statusCode === 429 : false,
      timestamp: Date.now(),
    };

    if (statusCode !== undefined) {
      error.statusCode = statusCode;
    }

    if (details !== undefined) {
      error.details = details;
    }

    return error;
  }

  protected handleError(error: unknown): never {
    // If it's already an LLMCoreError, re-throw it as is
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error as any).name === "LLMCoreError"
    ) {
      throw error;
    }

    if (error instanceof Error) {
      throw this.createError(
        "unknown",
        "PROVIDER_ERROR",
        error.message,
        undefined,
        { originalError: error.name }
      );
    }

    throw this.createError(
      "unknown",
      "UNKNOWN_ERROR",
      "An unknown error occurred"
    );
  }
}
