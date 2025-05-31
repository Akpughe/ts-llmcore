/**
 * Cost Calculation Utilities
 * Accurate cost estimation for different providers and models
 */

import type { UsageMetrics, ModelName, ProviderName } from "../types/index";
import { TokenCounter } from "./token-counter";

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  breakdown: {
    inputTokens: number;
    outputTokens: number;
    inputRate: number;
    outputRate: number;
    unit: string;
  };
}

export interface CostEstimate {
  estimated: CostBreakdown;
  confidence: "high" | "medium" | "low";
  factors: string[];
  lastUpdated: string;
}

export interface BillingPeriod {
  period: "hourly" | "daily" | "weekly" | "monthly";
  costs: CostBreakdown[];
  totalCost: number;
  averageCost: number;
  peakCost: number;
  requestCount: number;
}

export class CostCalculator {
  // Comprehensive pricing data (updated as of recent rates)
  private static readonly PRICING_DATA: Record<
    ProviderName,
    Record<
      string,
      {
        input: number;
        output: number;
        unit: number;
        currency: string;
        effectiveDate: string;
        notes?: string;
      }
    >
  > = {
    openai: {
      "gpt-4o": {
        input: 2.5,
        output: 10,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      "gpt-4o-mini": {
        input: 0.15,
        output: 0.6,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      "gpt-4": {
        input: 30,
        output: 60,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      "gpt-3.5-turbo": {
        input: 0.5,
        output: 1.5,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      default: {
        input: 1,
        output: 2,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
    },
    claude: {
      "claude-3-opus-20240229": {
        input: 15,
        output: 75,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      "claude-3-sonnet-20240229": {
        input: 3,
        output: 15,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      "claude-3-haiku-20240307": {
        input: 0.25,
        output: 1.25,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      default: {
        input: 3,
        output: 15,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
    },
    groq: {
      "llama-3.1-8b-instant": {
        input: 0.05,
        output: 0.08,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      "llama-3.1-70b-versatile": {
        input: 0.59,
        output: 0.79,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      default: {
        input: 0.1,
        output: 0.1,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
    },
    grok: {
      "grok-beta": {
        input: 5,
        output: 15,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
      default: {
        input: 5,
        output: 15,
        unit: 1000000,
        currency: "USD",
        effectiveDate: "2024-01-01",
      },
    },
  };

  // Volume discounts (simplified)
  private static readonly VOLUME_DISCOUNTS: Record<
    ProviderName,
    Array<{
      threshold: number;
      discount: number;
    }>
  > = {
    openai: [
      { threshold: 1000000, discount: 0.05 }, // 5% off after 1M tokens
      { threshold: 10000000, discount: 0.1 }, // 10% off after 10M tokens
    ],
    claude: [
      { threshold: 5000000, discount: 0.03 },
      { threshold: 25000000, discount: 0.07 },
    ],
    groq: [
      { threshold: 100000000, discount: 0.15 }, // Groq offers better volume pricing
    ],
    grok: [{ threshold: 1000000, discount: 0.02 }],
  };

  /**
   * Calculate cost for a specific usage
   */
  static calculateCost(
    usage: UsageMetrics,
    model: ModelName,
    provider: ProviderName
  ): CostBreakdown {
    const pricing = this.getPricing(model, provider);
    if (!pricing) {
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: "USD",
        breakdown: {
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          inputRate: 0,
          outputRate: 0,
          unit: "per 1M tokens",
        },
      };
    }

    const inputCost = (usage.promptTokens / pricing.unit) * pricing.input;
    const outputCost = (usage.completionTokens / pricing.unit) * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: pricing.currency,
      breakdown: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        inputRate: pricing.input,
        outputRate: pricing.output,
        unit: `per ${pricing.unit.toLocaleString()} tokens`,
      },
    };
  }

  /**
   * Estimate cost for a conversation before sending
   */
  static estimateCost(
    messages: any[],
    model: ModelName,
    provider: ProviderName,
    expectedOutputTokens: number = 500
  ): CostEstimate {
    const tokenCount = TokenCounter.countConversationTokens(messages, {
      provider,
      model,
    });

    const mockUsage: UsageMetrics = {
      promptTokens: tokenCount.tokens,
      completionTokens: expectedOutputTokens,
      totalTokens: tokenCount.tokens + expectedOutputTokens,
    };

    const cost = this.calculateCost(mockUsage, model, provider);

    // Determine confidence based on various factors
    const factors: string[] = [];
    let confidence: "high" | "medium" | "low" = "high";

    if (expectedOutputTokens > 2000) {
      factors.push("High output token estimate - actual cost may vary");
      confidence = "medium";
    }

    if (messages.some((m: any) => m.role === "tool")) {
      factors.push("Tool usage may incur additional costs");
      confidence = "medium";
    }

    const modelPricing = this.PRICING_DATA[provider][model];
    const defaultPricing = this.PRICING_DATA[provider]["default"];

    if (!modelPricing || !defaultPricing) {
      factors.push("Using default pricing for model");
      confidence = "low";
    }

    return {
      estimated: cost,
      confidence,
      factors,
      lastUpdated:
        modelPricing?.effectiveDate ||
        defaultPricing?.effectiveDate ||
        new Date().toISOString(),
    };
  }

  /**
   * Calculate cost with volume discounts
   */
  static calculateWithDiscount(
    usage: UsageMetrics,
    model: ModelName,
    provider: ProviderName,
    monthlyTokenUsage: number = 0
  ): CostBreakdown & {
    originalCost: number;
    discount: number;
    discountPercentage: number;
  } {
    const baseCost = this.calculateCost(usage, model, provider);
    const totalTokens = monthlyTokenUsage + usage.totalTokens;

    const discount = this.calculateVolumeDiscount(provider, totalTokens);
    const discountAmount = baseCost.totalCost * discount;

    return {
      ...baseCost,
      totalCost: baseCost.totalCost - discountAmount,
      originalCost: baseCost.totalCost,
      discount: discountAmount,
      discountPercentage: discount * 100,
    };
  }

  /**
   * Compare costs across providers
   */
  static compareCosts(
    usage: UsageMetrics,
    model: ModelName,
    providers: ProviderName[]
  ): Array<{
    provider: ProviderName;
    cost: CostBreakdown;
    ranking: number;
    savings?: number | undefined;
  }> {
    const costs = providers.map((provider) => ({
      provider,
      cost: this.calculateCost(usage, model, provider),
    }));

    // Sort by total cost
    costs.sort((a, b) => a.cost.totalCost - b.cost.totalCost);

    const cheapest = costs[0]?.cost.totalCost ?? 0;

    return costs.map((item, index) => ({
      ...item,
      ranking: index + 1,
      savings: index === 0 ? undefined : item.cost.totalCost - cheapest,
    }));
  }

  /**
   * Calculate monthly billing estimate
   */
  static calculateMonthlyEstimate(
    dailyUsage: UsageMetrics[],
    model: ModelName,
    provider: ProviderName
  ): BillingPeriod {
    const costs = dailyUsage.map((usage) =>
      this.calculateCost(usage, model, provider)
    );
    const totalCost = costs.reduce((sum, cost) => sum + cost.totalCost, 0);
    const monthlyTotal = totalCost * (30 / dailyUsage.length); // Scale to monthly

    return {
      period: "monthly",
      costs,
      totalCost: monthlyTotal,
      averageCost: totalCost / dailyUsage.length,
      peakCost: Math.max(...costs.map((c) => c.totalCost)),
      requestCount: dailyUsage.length,
    };
  }

  /**
   * Get cost efficiency metrics
   */
  static getEfficiencyMetrics(
    usage: UsageMetrics,
    model: ModelName,
    provider: ProviderName
  ): {
    costPerToken: number;
    costPerWord: number;
    costPerCharacter: number;
    efficiency: "high" | "medium" | "low";
  } {
    const cost = this.calculateCost(usage, model, provider);
    const costPerToken = cost.totalCost / usage.totalTokens;

    // Rough estimates for words and characters
    const estimatedWords = usage.totalTokens * 0.75; // ~0.75 words per token
    const estimatedChars = usage.totalTokens * 4; // ~4 chars per token

    const costPerWord = cost.totalCost / estimatedWords;
    const costPerCharacter = cost.totalCost / estimatedChars;

    // Determine efficiency based on cost per token
    let efficiency: "high" | "medium" | "low" = "medium";
    if (costPerToken < 0.00001) efficiency = "high";
    else if (costPerToken > 0.0001) efficiency = "low";

    return {
      costPerToken,
      costPerWord,
      costPerCharacter,
      efficiency,
    };
  }

  /**
   * Budget tracking utilities
   */
  static checkBudget(
    usage: UsageMetrics,
    model: ModelName,
    provider: ProviderName,
    budget: {
      limit: number;
      period: "daily" | "weekly" | "monthly";
      currentSpend: number;
    }
  ): {
    cost: CostBreakdown;
    willExceed: boolean;
    remainingBudget: number;
    percentageUsed: number;
    daysUntilReset?: number;
  } {
    const cost = this.calculateCost(usage, model, provider);
    const newTotal = budget.currentSpend + cost.totalCost;
    const willExceed = newTotal > budget.limit;
    const remainingBudget = budget.limit - newTotal;
    const percentageUsed = (newTotal / budget.limit) * 100;

    return {
      cost,
      willExceed,
      remainingBudget,
      percentageUsed,
      // Note: would need actual date logic for daysUntilReset
    };
  }

  // Private helper methods
  private static getPricing(model: ModelName, provider: ProviderName) {
    const providerPricing = this.PRICING_DATA[provider];
    if (!providerPricing) return null;
    return providerPricing[model] || providerPricing["default"];
  }

  private static calculateVolumeDiscount(
    provider: ProviderName,
    tokenUsage: number
  ): number {
    const discounts = this.VOLUME_DISCOUNTS[provider] || [];

    for (let i = discounts.length - 1; i >= 0; i--) {
      const discount = discounts[i];
      if (discount && tokenUsage >= discount.threshold) {
        return discount.discount;
      }
    }

    return 0; // No discount
  }

  // private static getCheaperModels(
  //   currentModel: ModelName,
  //   provider: ProviderName
  // ): ModelName[] {
  //   const pricing = this.PRICING_DATA[provider];
  //   if (!pricing) return [];

  //   const currentPricing = pricing[currentModel] || pricing["default"];
  //   if (!currentPricing) return [];

  //   return Object.keys(pricing)
  //     .filter((model) => model !== "default" && model !== currentModel)
  //     .filter((model) => {
  //       const modelPricing = pricing[model];
  //       if (!modelPricing) return false;

  //       return (
  //         modelPricing.input < currentPricing.input &&
  //         modelPricing.output < currentPricing.output
  //       );
  //     }) as ModelName[];
  // }

  // private static findCheaperModels(
  //   currentModel: ModelName,
  //   provider: ProviderName
  // ): ModelName[] {
  //   // Use a sample usage to compare costs
  //   const sampleUsage: UsageMetrics = {
  //     promptTokens: 1000000,
  //     completionTokens: 1000000,
  //     totalTokens: 2000000,
  //   };

  //   const currentPricing = CostCalculator.calculateCost(
  //     sampleUsage,
  //     currentModel,
  //     provider
  //   );

  //   // Get all known models for this provider
  //   const knownModels: ModelName[] = this.getKnownModels(provider);

  //   return knownModels
  //     .filter((model) => model !== currentModel)
  //     .filter((model) => {
  //       const modelPricing = CostCalculator.calculateCost(
  //         sampleUsage,
  //         model,
  //         provider
  //       );

  //       return (
  //         modelPricing.inputCost < currentPricing.inputCost &&
  //         modelPricing.outputCost < currentPricing.outputCost
  //       );
  //     });
  // }

  // private static getKnownModels(provider: ProviderName): ModelName[] {
  //   switch (provider) {
  //     case "openai":
  //       return ["gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
  //     case "claude":
  //       return [
  //         "claude-3-opus-20240229",
  //         "claude-3-sonnet-20240229",
  //         "claude-3-haiku-20240307",
  //       ];
  //     case "groq":
  //       return ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"];
  //     case "grok":
  //       return ["grok-beta", "grok-vision-beta"];
  //     default:
  //       return [];
  //   }
  // }
}

/**
 * Cost optimization utilities
 */
export class CostOptimizer {
  /**
   * Suggest cost optimization strategies
   */
  static getOptimizationSuggestions(
    usage: UsageMetrics,
    model: ModelName,
    provider: ProviderName
  ): Array<{
    strategy: string;
    potentialSavings: number;
    difficulty: "easy" | "medium" | "hard";
    description: string;
  }> {
    const suggestions = [];
    const currentCost = CostCalculator.calculateCost(usage, model, provider);

    // Check if a cheaper model might work
    const cheaperModels = this.findCheaperModels(model, provider);
    if (cheaperModels.length > 0) {
      const cheapestModel = cheaperModels[0];
      if (cheapestModel) {
        const cheapestCost = CostCalculator.calculateCost(
          usage,
          cheapestModel,
          provider
        );
        suggestions.push({
          strategy: "Use cheaper model",
          potentialSavings: currentCost.totalCost - cheapestCost.totalCost,
          difficulty: "easy" as const,
          description: `Switch to ${cheapestModel} for potential savings`,
        });
      }
    }

    // Check if a different provider might be cheaper
    const allProviders: ProviderName[] = ["openai", "claude", "groq", "grok"];
    const costs = CostCalculator.compareCosts(usage, model, allProviders);
    const cheapestProvider = costs[0];

    if (
      cheapestProvider &&
      cheapestProvider.provider !== provider &&
      costs.length > 1
    ) {
      const currentProviderCost =
        costs.find((c) => c.provider === provider)?.cost.totalCost || 0;
      suggestions.push({
        strategy: "Switch provider",
        potentialSavings: currentProviderCost - cheapestProvider.cost.totalCost,
        difficulty: "medium" as const,
        description: `Use ${cheapestProvider.provider} instead of ${provider}`,
      });
    }

    // Token optimization suggestions
    if (usage.promptTokens > 1000) {
      suggestions.push({
        strategy: "Optimize prompts",
        potentialSavings: currentCost.totalCost * 0.2, // Estimate 20% savings
        difficulty: "medium" as const,
        description: "Reduce prompt length and optimize message structure",
      });
    }

    return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Get cheaper model alternatives
   */
  private static findCheaperModels(
    currentModel: ModelName,
    provider: ProviderName
  ): ModelName[] {
    // Use a sample usage to compare costs
    const sampleUsage: UsageMetrics = {
      promptTokens: 1000000,
      completionTokens: 1000000,
      totalTokens: 2000000,
    };

    const currentPricing = CostCalculator.calculateCost(
      sampleUsage,
      currentModel,
      provider
    );

    // Get all known models for this provider
    const knownModels: ModelName[] = this.getKnownModels(provider);

    return knownModels
      .filter((model) => model !== currentModel)
      .filter((model) => {
        const modelPricing = CostCalculator.calculateCost(
          sampleUsage,
          model,
          provider
        );

        return (
          modelPricing.inputCost < currentPricing.inputCost &&
          modelPricing.outputCost < currentPricing.outputCost
        );
      });
  }

  private static getKnownModels(provider: ProviderName): ModelName[] {
    switch (provider) {
      case "openai":
        return ["gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
      case "claude":
        return [
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307",
        ];
      case "groq":
        return ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"];
      case "grok":
        return ["grok-beta", "grok-vision-beta"];
      default:
        return [];
    }
  }
}
