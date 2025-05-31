/**
 * Response Standardization Utilities
 * Normalize responses across providers, handle token usage tracking, metadata, and cost calculation
 */

import type {
  ChatResponse,
  StreamingChatResponse,
  UsageMetrics,
  ProviderName,
  ModelName,
  Message,
  AssistantMessage,
  LLMCoreError,
  ResponseMetadata,
} from "../types/index";

export interface EnhancedResponseMetadata extends ResponseMetadata {
  // Original provider response
  raw?: any;
  // Processing time
  processingTime?: number;
  // Request timestamp
  requestTimestamp: number;
  // Response timestamp
  responseTimestamp: number;
  // Provider-specific metadata
  providerMetadata?: Record<string, unknown>;
  // Cost information
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  };
  // Model capabilities used
  capabilities?: {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    multimodal: boolean;
  };
  // Quality metrics
  quality?: {
    confidence?: number;
    relevance?: number;
    completeness?: number;
  };
}

export interface StandardizedResponse extends Omit<ChatResponse, "metadata"> {
  metadata: EnhancedResponseMetadata;
}

export interface StandardizedStreamResponse
  extends Omit<StreamingChatResponse, "metadata"> {
  metadata: EnhancedResponseMetadata & {
    chunkIndex: number;
    totalChunks?: number;
    streamStartTime: number;
    latency?: number;
    bufferSize?: number;
  };
}

export class ResponseStandardizer {
  /**
   * Standardize a chat response from any provider
   */
  static standardize(
    response: ChatResponse,
    options: {
      includeRaw?: boolean;
      calculateCost?: boolean;
      startTime?: number;
      providerMetadata?: Record<string, unknown>;
    } = {}
  ): StandardizedResponse {
    const now = Date.now();
    const processingTime = options.startTime
      ? now - options.startTime
      : undefined;

    const metadata: EnhancedResponseMetadata = {
      ...response.metadata,
      requestTimestamp: options.startTime || now,
      responseTimestamp: now,
      ...(processingTime && { processingTime }),
      ...(options.includeRaw && { raw: response }),
      ...(options.providerMetadata && {
        providerMetadata: options.providerMetadata,
      }),
      ...(options.calculateCost &&
        response.usage && {
          cost: this.calculateResponseCost(response),
        }),
      capabilities: this.detectCapabilities(response),
      quality: this.assessQuality(response),
    };

    return {
      ...response,
      metadata,
    };
  }

  /**
   * Standardize a streaming response chunk
   */
  static standardizeStream(
    chunk: StreamingChatResponse,
    chunkIndex: number,
    streamStartTime: number
  ): StandardizedStreamResponse {
    const now = Date.now();

    const metadata = {
      ...chunk.metadata,
      chunkIndex,
      streamStartTime,
      latency: now - streamStartTime,
      bufferSize: JSON.stringify(chunk).length,
      requestTimestamp: streamStartTime,
      responseTimestamp: now,
    };

    return {
      ...chunk,
      metadata,
    };
  }

  /**
   * Normalize response format across providers
   */
  static normalizeResponse(
    response: any,
    provider: ProviderName
  ): ChatResponse {
    switch (provider) {
      case "openai":
        return this.normalizeOpenAIResponse(response);
      case "claude":
        return this.normalizeClaudeResponse(response);
      case "groq":
        return this.normalizeGroqResponse(response);
      case "grok":
        return this.normalizeGrokResponse(response);
      default:
        throw new Error(`Unsupported provider for normalization: ${provider}`);
    }
  }

  /**
   * Extract and standardize token usage information
   */
  static standardizeUsage(usage: any, provider: ProviderName): UsageMetrics {
    const baseUsage: UsageMetrics = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    switch (provider) {
      case "openai":
      case "groq":
      case "grok":
        return {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          ...(usage.processing_time && {
            processingTime: usage.processing_time,
          }),
          ...(usage.queue_time && { queueTime: usage.queue_time }),
        };

      case "claude":
        return {
          promptTokens: usage.input_tokens || 0,
          completionTokens: usage.output_tokens || 0,
          totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        };

      default:
        return baseUsage;
    }
  }

  /**
   * Standardize error responses
   */
  static standardizeError(
    error: any,
    provider: ProviderName,
    context?: any
  ): LLMCoreError {
    const baseError: LLMCoreError = {
      name: "LLMCoreError",
      type: "unknown",
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
      provider,
      retryable: false,
      timestamp: Date.now(),
    };

    // Provider-specific error mapping
    switch (provider) {
      case "openai":
        return this.standardizeOpenAIError(error, baseError);
      case "claude":
        return this.standardizeClaudeError(error, baseError);
      case "groq":
        return this.standardizeGroqError(error, baseError);
      case "grok":
        return this.standardizeGrokError(error, baseError);
      default:
        return { ...baseError, message: error.message || baseError.message };
    }
  }

  /**
   * Calculate response cost based on usage
   */
  private static calculateResponseCost(response: ChatResponse): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  } {
    if (!response.usage) {
      return { inputCost: 0, outputCost: 0, totalCost: 0, currency: "USD" };
    }

    // Model pricing (per 1K tokens for OpenAI, per 1M for others)
    const pricing = this.getModelPricing(response.model, response.provider);

    const inputCost =
      (response.usage.promptTokens / pricing.inputUnit) * pricing.inputPrice;
    const outputCost =
      (response.usage.completionTokens / pricing.outputUnit) *
      pricing.outputPrice;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: pricing.currency,
    };
  }

  /**
   * Detect capabilities used in the response
   */
  private static detectCapabilities(response: ChatResponse): {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    multimodal: boolean;
  } {
    const isAssistantMessage = response.message.role === "assistant";
    const hasToolCalls =
      isAssistantMessage &&
      (response.message as AssistantMessage).toolCalls &&
      (response.message as AssistantMessage).toolCalls!.length > 0;

    return {
      streaming: false, // Non-streaming response
      tools: !!hasToolCalls,
      vision: this.hasVisionContent(response.message),
      multimodal: this.hasMultimodalContent(response.message),
    };
  }

  /**
   * Assess response quality
   */
  private static assessQuality(response: ChatResponse): {
    confidence?: number;
    relevance?: number;
    completeness?: number;
  } {
    // Basic quality assessment - can be enhanced with ML models
    const contentLength = response.message.content.length;
    const isAssistantMessage = response.message.role === "assistant";
    const hasToolCalls =
      isAssistantMessage &&
      (response.message as AssistantMessage).toolCalls?.length;

    return {
      completeness: Math.min(contentLength / 100, 1), // Simple length-based metric
      confidence: response.finishReason === "stop" ? 0.9 : 0.7,
      relevance: hasToolCalls ? 0.95 : 0.8, // Tool calls suggest high relevance
    };
  }

  // Provider-specific normalization methods
  private static normalizeOpenAIResponse(response: any): ChatResponse {
    const choice = response.choices?.[0];
    if (!choice) throw new Error("No choices in OpenAI response");

    const message: AssistantMessage = {
      role: "assistant",
      content: choice.message.content || "",
      ...(choice.message.tool_calls && {
        toolCalls: choice.message.tool_calls.map((call: any) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        })),
      }),
    };

    return {
      id: response.id,
      provider: "openai",
      model: response.model,
      message,
      finishReason: choice.finish_reason,
      created: response.created,
      ...(response.usage && {
        usage: this.standardizeUsage(response.usage, "openai"),
      }),
    };
  }

  private static normalizeClaudeResponse(response: any): ChatResponse {
    const message: AssistantMessage = {
      role: "assistant",
      content: response.content?.[0]?.text || "",
      ...(response.tool_use && {
        toolCalls: response.tool_use.map((use: any) => ({
          id: use.id,
          type: "function",
          function: {
            name: use.name,
            arguments: JSON.stringify(use.input),
          },
        })),
      }),
    };

    return {
      id: response.id,
      provider: "claude",
      model: response.model,
      message,
      finishReason: response.stop_reason,
      created: Date.now(), // Claude doesn't provide created timestamp
      ...(response.usage && {
        usage: this.standardizeUsage(response.usage, "claude"),
      }),
    };
  }

  private static normalizeGroqResponse(response: any): ChatResponse {
    return this.normalizeOpenAIResponse(response); // Groq uses OpenAI format
  }

  private static normalizeGrokResponse(response: any): ChatResponse {
    return this.normalizeOpenAIResponse(response); // Grok uses OpenAI format
  }

  // Provider-specific error standardization
  private static standardizeOpenAIError(
    error: any,
    base: LLMCoreError
  ): LLMCoreError {
    const status = error.response?.status || error.status;

    if (status === 401) {
      return {
        ...base,
        type: "authentication",
        code: "INVALID_API_KEY",
        retryable: false,
      };
    } else if (status === 429) {
      return {
        ...base,
        type: "rate_limit",
        code: "RATE_LIMIT_EXCEEDED",
        retryable: true,
      };
    } else if (status >= 500) {
      return {
        ...base,
        type: "server_error",
        code: "SERVER_ERROR",
        retryable: true,
      };
    }

    return { ...base, message: error.message || base.message };
  }

  private static standardizeClaudeError(
    error: any,
    base: LLMCoreError
  ): LLMCoreError {
    const errorType = error.error?.type;

    if (errorType === "authentication_error") {
      return {
        ...base,
        type: "authentication",
        code: "INVALID_API_KEY",
        retryable: false,
      };
    } else if (errorType === "rate_limit_error") {
      return {
        ...base,
        type: "rate_limit",
        code: "RATE_LIMIT_EXCEEDED",
        retryable: true,
      };
    } else if (errorType === "server_error") {
      return {
        ...base,
        type: "server_error",
        code: "SERVER_ERROR",
        retryable: true,
      };
    }

    return { ...base, message: error.error?.message || base.message };
  }

  private static standardizeGroqError(
    error: any,
    base: LLMCoreError
  ): LLMCoreError {
    return this.standardizeOpenAIError(error, base); // Groq uses OpenAI format
  }

  private static standardizeGrokError(
    error: any,
    base: LLMCoreError
  ): LLMCoreError {
    return this.standardizeOpenAIError(error, base); // Grok uses OpenAI format
  }

  // Helper methods
  private static getModelPricing(model: ModelName, provider: ProviderName) {
    // Simplified pricing - in real implementation, this would be more comprehensive
    const pricing: Record<
      ProviderName,
      {
        inputPrice: number;
        outputPrice: number;
        inputUnit: number;
        outputUnit: number;
        currency: string;
      }
    > = {
      openai: {
        inputPrice: 0.0015,
        outputPrice: 0.002,
        inputUnit: 1000,
        outputUnit: 1000,
        currency: "USD",
      },
      claude: {
        inputPrice: 3,
        outputPrice: 15,
        inputUnit: 1000000,
        outputUnit: 1000000,
        currency: "USD",
      },
      groq: {
        inputPrice: 0.59,
        outputPrice: 0.79,
        inputUnit: 1000000,
        outputUnit: 1000000,
        currency: "USD",
      },
      grok: {
        inputPrice: 5,
        outputPrice: 15,
        inputUnit: 1000000,
        outputUnit: 1000000,
        currency: "USD",
      },
    };

    return pricing[provider];
  }

  private static hasVisionContent(message: Message): boolean {
    // Only user messages can have attachments with vision content
    if (message.role !== "user") return false;

    const userMessage = message as any; // Type assertion for attachments
    return !!userMessage.attachments?.some(
      (attachment: any) => attachment.type === "image"
    );
  }

  private static hasMultimodalContent(message: Message): boolean {
    const isAssistantWithTools =
      message.role === "assistant" &&
      (message as AssistantMessage).toolCalls?.length;

    return this.hasVisionContent(message) || !!isAssistantWithTools;
  }
}
