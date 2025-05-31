/**
 * Main LLMCore Class
 * Unified interface for multiple LLM providers with automatic routing and fallbacks
 */

import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  StreamResponse,
  ModelsResponse,
  ProviderName,
  ModelName,
  LLMCoreError,
  Message,
  LLMCoreConfig,
} from "../types/index";
import { ConfigurationManager } from "./config";
import {
  ProviderRouter,
  type RouterOptions,
  type ProviderMetrics,
} from "./router";

export interface LLMCoreOptions extends RouterOptions {
  // Additional LLMCore-specific options
  autoInitialize?: boolean;
  healthCheckInterval?: number;
  enableMetrics?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error" | "none";
}

export interface LLMCoreStatus {
  isInitialized: boolean;
  availableProviders: ProviderName[];
  defaultProvider: ProviderName | null;
  metrics: Map<ProviderName, ProviderMetrics>;
  lastHealthCheck?: Date;
}

export class LLMCore {
  private configManager: ConfigurationManager;
  private router: ProviderRouter;
  private options: LLMCoreOptions;
  private isInitialized = false;
  private healthCheckTimer: NodeJS.Timeout | undefined;

  constructor(config: LLMCoreConfig, options: LLMCoreOptions = {}) {
    this.configManager = new ConfigurationManager(config);
    this.options = {
      autoInitialize: true,
      healthCheckInterval: 300000, // 5 minutes
      enableMetrics: true,
      logLevel: "info",
      ...options,
    };

    this.router = new ProviderRouter(this.configManager, options);

    if (this.options.autoInitialize) {
      this.initialize().catch((error) => {
        this.log("error", "Auto-initialization failed:", error);
      });
    }
  }

  /**
   * Initialize LLMCore with configured providers
   */
  async initialize(): Promise<void> {
    try {
      this.log("info", "Initializing LLMCore...");

      // Validate configuration
      const validation = this.configManager.validateConfig();
      if (!validation.isValid) {
        throw new Error(
          `Configuration validation failed: ${validation.errors.join(", ")}`
        );
      }

      if (validation.warnings.length > 0) {
        this.log("warn", "Configuration warnings:", validation.warnings);
      }

      // Initialize router and providers
      await this.router.initialize();

      this.isInitialized = true;
      this.log(
        "info",
        `LLMCore initialized with providers: ${this.router
          .getAvailableProviders()
          .join(", ")}`
      );

      // Start health check if enabled
      if (
        this.options.healthCheckInterval &&
        this.options.healthCheckInterval > 0
      ) {
        this.startHealthChecks();
      }
    } catch (error) {
      this.log("error", "Failed to initialize LLMCore:", error);
      throw error;
    }
  }

  /**
   * Send a chat completion request
   */
  async chat(
    messages: Message[],
    options: Partial<ChatRequest> = {}
  ): Promise<ChatResponse> {
    this.ensureInitialized();

    const request: ChatRequest = {
      messages,
      model: options.model || this.getDefaultModel(options.provider),
      provider: options.provider || this.getDefaultProvider(),
      ...options,
    };

    try {
      this.log("debug", "Sending chat request:", {
        provider: request.provider,
        model: request.model,
        messageCount: messages.length,
      });

      const response = await this.router.chat(request);

      this.log("debug", "Chat response received:", {
        provider: response.provider,
        model: response.model,
        finishReason: response.finishReason,
      });

      return response;
    } catch (error) {
      this.log("error", "Chat request failed:", error);
      throw this.enhanceError(error as Error, request);
    }
  }

  /**
   * Send a streaming chat completion request
   */
  async chatStream(
    messages: Message[],
    options: Partial<ChatRequest> = {}
  ): Promise<StreamResponse<StreamingChatResponse>> {
    this.ensureInitialized();

    const request: ChatRequest = {
      messages,
      model: options.model || this.getDefaultModel(options.provider),
      provider: options.provider || this.getDefaultProvider(),
      stream: true,
      ...options,
    };

    try {
      this.log("debug", "Sending streaming chat request:", {
        provider: request.provider,
        model: request.model,
        messageCount: messages.length,
      });

      const response = await this.router.chatStream(request);

      this.log("debug", "Streaming chat response initiated:", {
        provider: request.provider,
        model: request.model,
      });

      return response;
    } catch (error) {
      this.log("error", "Streaming chat request failed:", error);
      throw this.enhanceError(error as Error, request);
    }
  }

  /**
   * Get available models from all providers
   */
  async getModels(provider?: ProviderName): Promise<ModelsResponse[]> {
    this.ensureInitialized();

    const providers = provider
      ? [provider]
      : this.router.getAvailableProviders();
    const results: ModelsResponse[] = [];

    for (const providerName of providers) {
      try {
        // We'd need to get the provider instance to call getModels
        // For now, return empty array as this would require router changes
        this.log("debug", `Getting models for provider: ${providerName}`);
      } catch (error) {
        this.log(
          "warn",
          `Failed to get models for provider ${providerName}:`,
          error
        );
      }
    }

    return results;
  }

  /**
   * Estimate cost for a request
   */
  async estimateCost(
    messages: Message[],
    options: Partial<ChatRequest> = {}
  ): Promise<number> {
    this.ensureInitialized();

    const request: ChatRequest = {
      messages,
      model: options.model || this.getDefaultModel(options.provider),
      provider: options.provider || this.getDefaultProvider(),
      ...options,
    };

    try {
      // We'd need router to expose provider instances for cost estimation
      // For now, return 0 as placeholder
      this.log("debug", "Estimating cost for request:", {
        provider: request.provider,
        model: request.model,
        messageCount: messages.length,
      });

      return 0; // Placeholder
    } catch (error) {
      this.log("warn", "Cost estimation failed:", error);
      return 0;
    }
  }

  /**
   * Get LLMCore status and metrics
   */
  getStatus(): LLMCoreStatus {
    return {
      isInitialized: this.isInitialized,
      availableProviders: this.isInitialized
        ? this.router.getAvailableProviders()
        : [],
      defaultProvider: this.isInitialized ? this.getDefaultProvider() : null,
      metrics: this.isInitialized ? this.router.getMetrics() : new Map(),
      ...(this.healthCheckTimer && { lastHealthCheck: new Date() }),
    };
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(provider: ProviderName, config: any): void {
    this.configManager.updateProviderConfig(provider, config);
    this.log("info", `Updated configuration for provider: ${provider}`);
  }

  /**
   * Remove provider configuration
   */
  removeProviderConfig(provider: ProviderName): void {
    this.configManager.removeProviderConfig(provider);
    this.log("info", `Removed configuration for provider: ${provider}`);
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetCircuitBreaker(provider: ProviderName): void {
    if (this.isInitialized) {
      this.router.resetCircuitBreaker(provider);
      this.log("info", `Reset circuit breaker for provider: ${provider}`);
    }
  }

  /**
   * Manually trigger health checks
   */
  async runHealthChecks(): Promise<void> {
    if (!this.isInitialized) return;

    this.log("debug", "Running health checks...");

    // Health check logic would go here
    // For now, just log that it ran
    this.log("debug", "Health checks completed");
  }

  /**
   * Shutdown LLMCore and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.log("info", "Shutting down LLMCore...");

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.isInitialized = false;
    this.log("info", "LLMCore shutdown complete");
  }

  /**
   * Simple convenience method for single message completion
   */
  async complete(
    prompt: string,
    options: Partial<ChatRequest> = {}
  ): Promise<string> {
    const messages: Message[] = [{ role: "user", content: prompt }];
    const response = await this.chat(messages, options);
    return response.message.content;
  }

  /**
   * Simple convenience method for system + user message completion
   */
  async ask(
    question: string,
    systemPrompt?: string,
    options: Partial<ChatRequest> = {}
  ): Promise<string> {
    const messages: Message[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: question });

    const response = await this.chat(messages, options);
    return response.message.content;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "LLMCore is not initialized. Call initialize() first or enable autoInitialize."
      );
    }
  }

  private getDefaultProvider(): ProviderName {
    try {
      return this.configManager.getDefaultProvider();
    } catch (error) {
      throw new Error(
        "No default provider available. Please check your configuration."
      );
    }
  }

  private getDefaultModel(provider?: ProviderName): ModelName {
    const targetProvider = provider || this.getDefaultProvider();
    return this.configManager.getDefaultModel(targetProvider);
  }

  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        this.log("error", "Health check failed:", error);
      }
    }, this.options.healthCheckInterval!);

    this.log(
      "debug",
      `Health checks started with interval: ${this.options.healthCheckInterval}ms`
    );
  }

  private enhanceError(error: Error, request: ChatRequest): LLMCoreError {
    // If it's already an LLMCoreError, return as-is
    if ("type" in error && "provider" in error) {
      return error as LLMCoreError;
    }

    // Create enhanced error with request context
    return {
      name: "LLMCoreError",
      type: "unknown",
      code: "REQUEST_FAILED",
      message: error.message,
      provider: request.provider,
      retryable: false,
      timestamp: Date.now(),
      details: {
        originalError: error.name,
        requestModel: request.model,
        requestProvider: request.provider,
      },
    };
  }

  private log(level: string, message: string, ...args: any[]): void {
    if (this.options.logLevel === "none") return;

    const levels = ["debug", "info", "warn", "error"];
    const configLevel = this.options.logLevel || "info";
    const currentLevelIndex = levels.indexOf(level);
    const configLevelIndex = levels.indexOf(configLevel);

    if (currentLevelIndex >= configLevelIndex) {
      const timestamp = new Date().toISOString();
      console[level as "log"](
        `[${timestamp}] [LLMCore:${level.toUpperCase()}]`,
        message,
        ...args
      );
    }
  }
}
