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
    if (!pricing) return 0;

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
    const truncatedMessages: Message[] = [];
    const removedMessages: Message[] = [];

    // Always keep system message first
    const systemMessage = messages.find((m) => m.role === "system");
    if (systemMessage) {
      truncatedMessages.push(systemMessage);
    }

    // Add messages from most recent backwards until limit
    const nonSystemMessages = messages
      .filter((m) => m.role !== "system")
      .reverse();

    for (const message of nonSystemMessages) {
      const testMessages = [
        systemMessage,
        ...truncatedMessages,
        message,
      ].filter(Boolean) as Message[];
      const tokenCount = this.countConversationTokens(
        testMessages,
        options
      ).tokens;

      if (tokenCount <= limit) {
        truncatedMessages.unshift(message);
      } else {
        removedMessages.unshift(message);
      }
    }

    const finalTokenCount = this.countConversationTokens(
      systemMessage ? [systemMessage, ...truncatedMessages] : truncatedMessages,
      options
    ).tokens;

    return {
      truncatedMessages: systemMessage
        ? [systemMessage, ...truncatedMessages]
        : truncatedMessages,
      removedMessages,
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
    // Simplified pricing structure
    const pricing: Record<
      ProviderName,
      { inputPrice: number; outputPrice: number; unit: number }
    > = {
      openai: { inputPrice: 0.0015, outputPrice: 0.002, unit: 1000 },
      claude: { inputPrice: 3, outputPrice: 15, unit: 1000000 },
      groq: { inputPrice: 0.59, outputPrice: 0.79, unit: 1000000 },
      grok: { inputPrice: 5, outputPrice: 15, unit: 1000000 },
    };

    return pricing[provider] || null;
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
        percentage: (count.tokens / total.tokens) * 100,
      });
    });

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

    if (current.tokens > targetTokens) {
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
      canOptimize: current.tokens > targetTokens,
    };
  }
}
