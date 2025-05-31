/**
 * Token Counting Utilities
 * Accurate token counting for different providers and models
 */

import type { Message, ModelName, ProviderName } from "../types/index";

export interface TokenCount {
  tokens: number;
  characters: number;
  words: number;
  estimatedCost?: number;
}

export interface TokenCountOptions {
  includeSystemMessage?: boolean;
  includeToolDescriptions?: boolean;
  model?: ModelName;
  provider?: ProviderName;
}

export class TokenCounter {
  // Token ratios for different providers (approximate)
  private static readonly TOKEN_RATIOS: Record<
    ProviderName,
    {
      textToToken: number;
      wordToToken: number;
      overhead: number;
    }
  > = {
    openai: { textToToken: 0.75, wordToToken: 1.3, overhead: 0.1 },
    claude: { textToToken: 0.8, wordToToken: 1.2, overhead: 0.05 },
    groq: { textToToken: 0.75, wordToToken: 1.3, overhead: 0.1 },
    grok: { textToToken: 0.75, wordToToken: 1.3, overhead: 0.1 },
  };

  // Model-specific adjustments
  private static readonly MODEL_ADJUSTMENTS: Partial<
    Record<ModelName, number>
  > = {
    "gpt-4": 1.1,
    "gpt-4o": 1.02,
    "gpt-4o-mini": 1.0,
    "gpt-3.5-turbo": 1.0,
    "claude-3-opus-20240229": 1.15,
    "claude-3-sonnet-20240229": 1.1,
    "claude-3-haiku-20240307": 1.0,
    "llama-3.1-8b-instant": 0.95,
    "llama-3.1-70b-versatile": 1.05,
    "grok-beta": 1.1,
  };

  /**
   * Count tokens in a message
   */
  static countMessageTokens(
    message: Message,
    options: TokenCountOptions = {}
  ): TokenCount {
    const provider = options.provider || "openai";
    const model = options.model;

    // Get base counts
    const content = message.content;
    const characters = content.length;
    const words = this.countWords(content);

    // Calculate token estimate
    let tokens = this.estimateTokens(content, provider);

    // Add overhead for message structure
    tokens += this.getMessageOverhead(message, provider);

    // Apply model-specific adjustments
    if (model && this.MODEL_ADJUSTMENTS[model]) {
      tokens *= this.MODEL_ADJUSTMENTS[model]!;
    }

    return {
      tokens: Math.ceil(tokens),
      characters,
      words,
    };
  }

  /**
   * Count tokens in a conversation
   */
  static countConversationTokens(
    messages: Message[],
    options: TokenCountOptions = {}
  ): TokenCount {
    let totalTokens = 0;
    let totalCharacters = 0;
    let totalWords = 0;

    for (const message of messages) {
      // Skip system messages if not included
      if (!options.includeSystemMessage && message.role === "system") {
        continue;
      }

      const count = this.countMessageTokens(message, options);
      totalTokens += count.tokens;
      totalCharacters += count.characters;
      totalWords += count.words;
    }

    // Add conversation overhead
    const provider = options.provider || "openai";
    const conversationOverhead = this.getConversationOverhead(
      messages.length,
      provider
    );
    totalTokens += conversationOverhead;

    return {
      tokens: Math.ceil(totalTokens),
      characters: totalCharacters,
      words: totalWords,
    };
  }

  /**
   * Estimate tokens for tools/functions
   */
  static countToolTokens(
    tools: any[],
    options: TokenCountOptions = {}
  ): TokenCount {
    if (!tools || tools.length === 0) {
      return { tokens: 0, characters: 0, words: 0 };
    }

    const provider = options.provider || "openai";
    let totalTokens = 0;
    let totalCharacters = 0;
    let totalWords = 0;

    for (const tool of tools) {
      // Convert tool to text representation
      const toolText = JSON.stringify(tool, null, 2);
      const characters = toolText.length;
      const words = this.countWords(toolText);

      // Estimate tokens with tool overhead
      let tokens = this.estimateTokens(toolText, provider);
      tokens += this.getToolOverhead(provider);

      totalTokens += tokens;
      totalCharacters += characters;
      totalWords += words;
    }

    return {
      tokens: Math.ceil(totalTokens),
      characters: totalCharacters,
      words: totalWords,
    };
  }

  /**
   * Estimate cost based on token count
   */
  static estimateCost(
    tokenCount: number,
    model: ModelName,
    provider: ProviderName,
    type: "input" | "output" = "input"
  ): number {
    const pricing = this.getModelPricing(model, provider);
    if (!pricing) return 0; // Return 0 for unknown models

    const price = type === "input" ? pricing.inputPrice : pricing.outputPrice;
    const unit = pricing.unit;

    return (tokenCount / unit) * price;
  }

  /**
   * Check if message would exceed token limit
   */
  static wouldExceedLimit(
    messages: Message[],
    model: ModelName,
    maxTokens: number = 4096,
    options: TokenCountOptions = {}
  ): {
    wouldExceed: boolean;
    currentTokens: number;
    limitTokens: number;
    overflow: number;
  } {
    const currentTokens = this.countConversationTokens(
      messages,
      options
    ).tokens;
    const limitTokens = this.getModelTokenLimit(model) - maxTokens; // Reserve space for response
    const wouldExceed = currentTokens > limitTokens;

    return {
      wouldExceed,
      currentTokens,
      limitTokens,
      overflow: wouldExceed ? currentTokens - limitTokens : 0,
    };
  }

  /**
   * Truncate messages to fit within token limit
   */
  static truncateToLimit(
    messages: Message[],
    model: ModelName,
    maxTokens: number = 4096,
    options: TokenCountOptions = {}
  ): {
    truncatedMessages: Message[];
    removedMessages: Message[];
    finalTokenCount: number;
  } {
    const limit = this.getModelTokenLimit(model) - maxTokens;
    const result: Message[] = [];
    const removed: Message[] = [];

    // Separate system and non-system messages
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    // Always include system messages first
    result.push(...systemMessages);

    // Add non-system messages from most recent until we hit the limit
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const testMessages = [...result, message];
      const testTokenCount = this.countConversationTokens(
        testMessages.filter((m): m is Message => m !== undefined),
        options
      ).tokens;

      if (testTokenCount <= limit) {
        result.push(message as Message);
      } else {
        // Add all remaining messages to removed
        for (let j = 0; j <= i; j++) {
          removed.unshift(nonSystemMessages[j] as Message);
        }
        break;
      }
    }

    // Sort non-system messages back to original order
    const finalSystemMessages = result.filter((m) => m.role === "system");
    const finalNonSystemMessages = result.filter((m) => m.role !== "system");

    // Sort by original index
    finalNonSystemMessages.sort((a, b) => {
      const indexA = messages.indexOf(a);
      const indexB = messages.indexOf(b);
      return indexA - indexB;
    });

    const finalMessages = [...finalSystemMessages, ...finalNonSystemMessages];
    const finalTokenCount = this.countConversationTokens(
      finalMessages,
      options
    ).tokens;

    return {
      truncatedMessages: finalMessages,
      removedMessages: removed,
      finalTokenCount,
    };
  }

  // Private helper methods
  private static estimateTokens(text: string, provider: ProviderName): number {
    const ratios = this.TOKEN_RATIOS[provider];
    const words = this.countWords(text);

    // Use character-based estimation for short texts, word-based for longer
    if (text.length < 100) {
      return text.length * ratios.textToToken;
    } else {
      return words * ratios.wordToToken;
    }
  }

  private static countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private static getMessageOverhead(
    message: Message,
    provider: ProviderName
  ): number {
    let overhead = 4; // Base overhead for role and structure

    // Additional overhead for tool calls
    if (message.role === "assistant") {
      const assistantMessage = message as any;
      if (assistantMessage.toolCalls) {
        overhead += assistantMessage.toolCalls.length * 10;
      }
    }

    // Provider-specific adjustments
    switch (provider) {
      case "claude":
        overhead *= 0.8; // Claude has less overhead
        break;
      case "openai":
        overhead *= 1.0;
        break;
      default:
        overhead *= 1.1;
    }

    return overhead;
  }

  private static getConversationOverhead(
    messageCount: number,
    provider: ProviderName
  ): number {
    const base = messageCount * 2; // Base overhead per message

    switch (provider) {
      case "claude":
        return base * 0.7;
      case "openai":
        return base * 1.0;
      default:
        return base * 1.2;
    }
  }

  private static getToolOverhead(provider: ProviderName): number {
    switch (provider) {
      case "openai":
        return 15; // OpenAI function calling overhead
      case "claude":
        return 20; // Claude tool use overhead
      default:
        return 25; // Conservative estimate
    }
  }

  private static getModelTokenLimit(model: ModelName): number {
    // Token limits for different models
    const limits: Partial<Record<ModelName, number>> = {
      "gpt-4": 8192,
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "gpt-3.5-turbo": 16385,
      "claude-3-opus-20240229": 200000,
      "claude-3-sonnet-20240229": 200000,
      "claude-3-haiku-20240307": 200000,
      "llama-3.1-8b-instant": 8192,
      "llama-3.1-70b-versatile": 8192,
      "grok-beta": 131072,
    };

    return limits[model] || 4096; // Default fallback
  }

  private static getModelPricing(
    model: ModelName,
    provider: ProviderName
  ): {
    inputPrice: number;
    outputPrice: number;
    unit: number;
  } | null {
    // Model-specific pricing structure
    const modelPricing: Partial<
      Record<
        ModelName,
        { inputPrice: number; outputPrice: number; unit: number }
      >
    > = {
      "gpt-4": { inputPrice: 0.03, outputPrice: 0.06, unit: 1000 },
      "gpt-4o": { inputPrice: 0.005, outputPrice: 0.015, unit: 1000 },
      "gpt-4o-mini": { inputPrice: 0.00015, outputPrice: 0.0006, unit: 1000 },
      "gpt-3.5-turbo": { inputPrice: 0.0005, outputPrice: 0.0015, unit: 1000 },
      "claude-3-opus-20240229": {
        inputPrice: 15,
        outputPrice: 75,
        unit: 1000000,
      },
      "claude-3-sonnet-20240229": {
        inputPrice: 3,
        outputPrice: 15,
        unit: 1000000,
      },
      "claude-3-haiku-20240307": {
        inputPrice: 0.25,
        outputPrice: 1.25,
        unit: 1000000,
      },
      "llama-3.1-8b-instant": {
        inputPrice: 0.05,
        outputPrice: 0.08,
        unit: 1000000,
      },
      "llama-3.1-70b-versatile": {
        inputPrice: 0.59,
        outputPrice: 0.79,
        unit: 1000000,
      },
      "grok-beta": { inputPrice: 5, outputPrice: 15, unit: 1000000 },
    };

    // Return model-specific pricing or null if model not found
    return modelPricing[model] || null;
  }
}

/**
 * Advanced token analysis utilities
 */
export class TokenAnalyzer {
  /**
   * Analyze token distribution in conversation
   */
  static analyzeConversation(
    messages: Message[],
    options: TokenCountOptions = {}
  ): {
    totalTokens: number;
    byRole: Record<string, number>;
    byMessage: Array<{
      index: number;
      role: string;
      tokens: number;
      percentage: number;
    }>;
    efficiency: number;
  } {
    const total = TokenCounter.countConversationTokens(messages, options);
    const byRole: Record<string, number> = {};
    const byMessage: Array<{
      index: number;
      role: string;
      tokens: number;
      percentage: number;
    }> = [];

    messages.forEach((message, index) => {
      const count = TokenCounter.countMessageTokens(message, options);

      byRole[message.role] = (byRole[message.role] || 0) + count.tokens;
      byMessage.push({
        index,
        role: message.role,
        tokens: count.tokens,
        percentage: (count.tokens / total.tokens) * 100, // Calculate raw percentage first
      });
    });

    // Normalize percentages to sum to exactly 100%
    const totalPercentage = byMessage.reduce(
      (sum, msg) => sum + msg.percentage,
      0
    );
    if (totalPercentage > 0) {
      byMessage.forEach((msg) => {
        msg.percentage = (msg.percentage / totalPercentage) * 100;
        msg.percentage = Math.round(msg.percentage * 100) / 100; // Round to 2 decimal places
      });
    }

    // Calculate efficiency (content tokens vs overhead)
    const contentTokens = total.tokens - messages.length * 5; // Rough overhead estimate
    const efficiency = contentTokens / total.tokens;

    return {
      totalTokens: total.tokens,
      byRole,
      byMessage,
      efficiency,
    };
  }

  /**
   * Get token usage recommendations
   */
  static getRecommendations(
    messages: Message[],
    model: ModelName,
    targetTokens: number,
    options: TokenCountOptions = {}
  ): {
    currentTokens: number;
    targetTokens: number;
    recommendations: string[];
    canOptimize: boolean;
  } {
    const current = TokenCounter.countConversationTokens(messages, options);
    const recommendations: string[] = [];
    const canOptimize = current.tokens > targetTokens;

    if (canOptimize) {
      const excess = current.tokens - targetTokens;
      recommendations.push(`Reduce content by ~${excess} tokens`);

      // Specific recommendations
      const analysis = this.analyzeConversation(messages, options);

      if ((analysis.byRole["system"] || 0) > targetTokens * 0.3) {
        recommendations.push("Consider shortening system message");
      }

      if ((analysis.byRole["user"] || 0) > targetTokens * 0.5) {
        recommendations.push("Consider condensing user messages");
      }

      if (analysis.efficiency < 0.7) {
        recommendations.push(
          "High overhead detected - consider message consolidation"
        );
      }
    }

    return {
      currentTokens: current.tokens,
      targetTokens,
      recommendations,
      canOptimize,
    };
  }
}
