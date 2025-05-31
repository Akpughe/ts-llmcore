/**
 * Provider Router for LLMCore package
 * Handles provider selection logic, request routing, and fallback mechanisms
 */

import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  StreamResponse,
  ProviderName,
  ModelName,
  LLMCoreError,
  ProviderConfig,
} from "../types/index";
import { OpenAIProvider } from "../providers/openai";
import { ClaudeProvider } from "../providers/claude";
import { GroqProvider } from "../providers/groq";
import { GrokProvider } from "../providers/grok";
import type { BaseProvider } from "../providers/base";
import type { ConfigurationManager } from "./config";

export interface RouterOptions {
  enableFallback?: boolean;
  fallbackProviders?: ProviderName[];
  retryAttempts?: number;
  retryDelay?: number;
  circuitBreaker?: {
    enabled?: boolean;
    failureThreshold?: number;
    resetTimeout?: number;
  };
}

export interface ProviderMetrics {
  requests: number;
  failures: number;
  successRate: number;
  averageLatency: number;
  lastFailure?: Date;
  isCircuitOpen: boolean;
}

export class ProviderRouter {
  private providers = new Map<ProviderName, BaseProvider>();
  private metrics = new Map<ProviderName, ProviderMetrics>();
  private configManager: ConfigurationManager;
  private options: RouterOptions;

  constructor(
    configManager: ConfigurationManager,
    options: RouterOptions = {}
  ) {
    this.configManager = configManager;
    this.options = {
      enableFallback: true,
      retryAttempts: 3,
      retryDelay: 1000,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        resetTimeout: 60000,
      },
      ...options,
    };
  }

  /**
   * Initialize providers based on configuration
   */
  async initialize(): Promise<void> {
    const validation = this.configManager.validateConfig();

    if (!validation.isValid) {
      throw this.createRouterError(
        "INITIALIZATION_FAILED",
        `Configuration validation failed: ${validation.errors.join(", ")}`
      );
    }

    // Initialize each valid provider
    for (const providerName of validation.validProviders) {
      try {
        const config = this.configManager.getProviderConfig(providerName);
        const provider = this.createProvider(providerName, config);

        // Verify provider is working
        await provider.getHealth();

        this.providers.set(providerName, provider);
        this.initializeMetrics(providerName);
      } catch (error) {
        console.warn(`Failed to initialize provider ${providerName}:`, error);
      }
    }

    if (this.providers.size === 0) {
      throw this.createRouterError(
        "NO_PROVIDERS_AVAILABLE",
        "No providers could be initialized"
      );
    }
  }

  /**
   * Route a chat request to the appropriate provider
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const provider = this.selectProvider(request);

    if (!provider) {
      throw this.createRouterError(
        "NO_PROVIDER_AVAILABLE",
        "No suitable provider available for request"
      );
    }

    try {
      const startTime = Date.now();
      const response = await this.executeWithRetry<ChatResponse>(
        provider,
        "chat",
        request
      );
      const latency = Date.now() - startTime;

      this.recordSuccess(provider.name as ProviderName, latency);
      return response;
    } catch (error) {
      this.recordFailure(provider.name as ProviderName);

      // Try fallback if enabled and error is retryable
      if (this.options.enableFallback && this.isRetryableError(error)) {
        return this.executeWithFallback<ChatResponse>(
          "chat",
          request,
          provider.name as ProviderName
        );
      }

      throw this.mapProviderError(error, provider.name as ProviderName);
    }
  }

  /**
   * Route a streaming chat request to the appropriate provider
   */
  async chatStream(
    request: ChatRequest
  ): Promise<StreamResponse<StreamingChatResponse>> {
    const provider = this.selectProvider(request);

    if (!provider) {
      throw this.createRouterError(
        "NO_PROVIDER_AVAILABLE",
        "No suitable provider available for streaming request"
      );
    }

    try {
      const startTime = Date.now();
      const response = await provider.chatStream(request);
      const latency = Date.now() - startTime;

      this.recordSuccess(provider.name as ProviderName, latency);
      return response;
    } catch (error) {
      this.recordFailure(provider.name as ProviderName);

      // For streaming, fallback is more complex, so we just throw the error
      throw this.mapProviderError(error, provider.name as ProviderName);
    }
  }

  /**
   * Get provider metrics
   */
  getMetrics(): Map<ProviderName, ProviderMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): ProviderName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: ProviderName): boolean {
    if (!this.providers.has(provider)) {
      return false;
    }

    const metrics = this.metrics.get(provider);
    return metrics ? !metrics.isCircuitOpen : false;
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetCircuitBreaker(provider: ProviderName): void {
    const metrics = this.metrics.get(provider);
    if (metrics) {
      metrics.isCircuitOpen = false;
      metrics.failures = 0;
      delete metrics.lastFailure;
    }
  }

  private selectProvider(request: ChatRequest): BaseProvider | null {
    // If request specifies a provider, use that
    if (request.provider && this.isProviderAvailable(request.provider)) {
      return this.providers.get(request.provider) || null;
    }

    // Otherwise, select based on model
    const providerForModel = this.getProviderForModel(request.model);
    if (providerForModel && this.isProviderAvailable(providerForModel)) {
      return this.providers.get(providerForModel) || null;
    }

    // Fallback to default provider
    try {
      const defaultProvider = this.configManager.getDefaultProvider();
      if (this.isProviderAvailable(defaultProvider)) {
        return this.providers.get(defaultProvider) || null;
      }
    } catch {
      // Default provider not available
    }

    // Last resort: use any available provider
    for (const [name, provider] of this.providers) {
      if (this.isProviderAvailable(name)) {
        return provider;
      }
    }

    return null;
  }

  private getProviderForModel(model: ModelName): ProviderName | null {
    // Model-to-provider mapping
    const modelProviderMap: Record<string, ProviderName> = {
      // OpenAI models
      "gpt-4": "openai",
      "gpt-4-turbo-preview": "openai",
      "gpt-4-0125-preview": "openai",
      "gpt-4o": "openai",
      "gpt-4o-mini": "openai",
      "gpt-3.5-turbo": "openai",
      "gpt-3.5-turbo-16k": "openai",

      // Claude models
      "claude-3-5-sonnet-20241022": "claude",
      "claude-3-opus-20240229": "claude",
      "claude-3-sonnet-20240229": "claude",
      "claude-3-haiku-20240307": "claude",

      // Groq models
      "llama-3.1-70b-versatile": "groq",
      "llama-3.1-8b-instant": "groq",
      "mixtral-8x7b-32768": "groq",
      "gemma-7b-it": "groq",
      "gemma2-9b-it": "groq",

      // Grok models
      "grok-beta": "grok",
      "grok-vision-beta": "grok",
    };

    return modelProviderMap[model] || null;
  }

  private createProvider(
    provider: ProviderName,
    config: ProviderConfig
  ): BaseProvider {
    switch (provider) {
      case "openai":
        return new OpenAIProvider(config);
      case "claude":
        return new ClaudeProvider(config);
      case "groq":
        return new GroqProvider(config);
      case "grok":
        return new GrokProvider(config);
      default:
        throw this.createRouterError(
          "UNSUPPORTED_PROVIDER",
          `Unsupported provider: ${provider}`
        );
    }
  }

  private async executeWithRetry<T>(
    provider: BaseProvider,
    method: "chat" | "chatStream",
    request: ChatRequest
  ): Promise<T> {
    const retryConfig = this.configManager.getRetryConfig();
    let lastError: Error;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        if (method === "chat") {
          return (await provider.chat(request)) as T;
        } else {
          return (await provider.chatStream(request)) as T;
        }
      } catch (error) {
        lastError = error as Error;

        // Don't retry on non-retryable errors
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === retryConfig.maxAttempts) {
          throw error;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(
          this.options.retryDelay! *
            Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private async executeWithFallback<T>(
    method: "chat" | "chatStream",
    request: ChatRequest,
    excludeProvider: ProviderName
  ): Promise<T> {
    const fallbackConfig = this.configManager.getFallbackConfig();

    if (!fallbackConfig.enabled) {
      throw this.createRouterError("FALLBACK_DISABLED", "Fallback is disabled");
    }

    // Try configured fallback providers
    for (const providerName of fallbackConfig.providers) {
      if (
        providerName === excludeProvider ||
        !this.isProviderAvailable(providerName)
      ) {
        continue;
      }

      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        const requestWithProvider = { ...request, provider: providerName };

        if (method === "chat") {
          return (await provider.chat(requestWithProvider)) as T;
        } else {
          return (await provider.chatStream(requestWithProvider)) as T;
        }
      } catch (error) {
        this.recordFailure(providerName);
        continue; // Try next fallback
      }
    }

    throw this.createRouterError(
      "ALL_FALLBACKS_FAILED",
      "All fallback providers failed"
    );
  }

  private isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const llmError = error as LLMCoreError;

    // Retry on specific error types
    return (
      llmError.type === "rate_limit" ||
      llmError.type === "server_error" ||
      llmError.type === "network" ||
      llmError.retryable === true
    );
  }

  private mapProviderError(
    error: unknown,
    provider: ProviderName
  ): LLMCoreError {
    if (error && typeof error === "object" && "type" in error) {
      return error as LLMCoreError;
    }

    // Create a generic error if not already an LLMCoreError
    return {
      name: "LLMCoreError",
      type: "unknown",
      code: "PROVIDER_ERROR",
      message:
        error instanceof Error ? error.message : "Unknown provider error",
      provider,
      retryable: false,
      timestamp: Date.now(),
    };
  }

  private initializeMetrics(provider: ProviderName): void {
    this.metrics.set(provider, {
      requests: 0,
      failures: 0,
      successRate: 1,
      averageLatency: 0,
      isCircuitOpen: false,
    });
  }

  private recordSuccess(provider: ProviderName, latency: number): void {
    const metrics = this.metrics.get(provider);
    if (!metrics) return;

    metrics.requests++;
    metrics.averageLatency =
      (metrics.averageLatency * (metrics.requests - 1) + latency) /
      metrics.requests;
    metrics.successRate =
      (metrics.requests - metrics.failures) / metrics.requests;

    // Reset circuit breaker on success
    if (metrics.isCircuitOpen && this.shouldResetCircuitBreaker(metrics)) {
      metrics.isCircuitOpen = false;
    }
  }

  private recordFailure(provider: ProviderName): void {
    const metrics = this.metrics.get(provider);
    if (!metrics) return;

    metrics.requests++;
    metrics.failures++;
    metrics.successRate =
      (metrics.requests - metrics.failures) / metrics.requests;
    metrics.lastFailure = new Date();

    // Check if circuit breaker should be triggered
    if (
      this.options.circuitBreaker?.enabled &&
      this.shouldOpenCircuitBreaker(metrics)
    ) {
      metrics.isCircuitOpen = true;
    }
  }

  private shouldOpenCircuitBreaker(metrics: ProviderMetrics): boolean {
    const threshold = this.options.circuitBreaker?.failureThreshold || 5;
    return metrics.failures >= threshold;
  }

  private shouldResetCircuitBreaker(metrics: ProviderMetrics): boolean {
    if (!metrics.lastFailure) return true;

    const resetTimeout = this.options.circuitBreaker?.resetTimeout || 60000;
    return Date.now() - metrics.lastFailure.getTime() > resetTimeout;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createRouterError(code: string, message: string): LLMCoreError {
    return {
      name: "LLMCoreError",
      type: "network",
      code,
      message,
      provider: "router" as any,
      retryable: false,
      timestamp: Date.now(),
    };
  }
}
