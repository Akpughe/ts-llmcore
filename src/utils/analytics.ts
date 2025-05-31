/**
 * Usage Analytics and Logging Utilities
 */

import type { UsageMetrics, ProviderName, ModelName } from "../types/index";

export interface AnalyticsEvent {
  timestamp: number;
  provider: ProviderName;
  model: ModelName;
  usage: UsageMetrics;
  cost?: number;
  latency?: number;
  success: boolean;
  errorType?: string;
}

export class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private maxEvents = 10000;

  trackEvent(event: AnalyticsEvent): void {
    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  getUsageStats(timeframe: "hour" | "day" | "week" | "month" = "day"): {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
    successRate: number;
    topProviders: Array<{ provider: ProviderName; count: number }>;
    topModels: Array<{ model: ModelName; count: number }>;
  } {
    const now = Date.now();
    const timeframes = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const cutoff = now - timeframes[timeframe];
    const relevantEvents = this.events.filter((e) => e.timestamp >= cutoff);

    const totalRequests = relevantEvents.length;
    const totalTokens = relevantEvents.reduce(
      (sum, e) => sum + e.usage.totalTokens,
      0
    );
    const totalCost = relevantEvents.reduce((sum, e) => sum + (e.cost || 0), 0);
    const avgLatency =
      relevantEvents.reduce((sum, e) => sum + (e.latency || 0), 0) /
        totalRequests || 0;
    const successRate =
      relevantEvents.filter((e) => e.success).length / totalRequests || 0;

    // Count providers and models
    const providerCounts = new Map<ProviderName, number>();
    const modelCounts = new Map<ModelName, number>();

    relevantEvents.forEach((event) => {
      providerCounts.set(
        event.provider,
        (providerCounts.get(event.provider) || 0) + 1
      );
      modelCounts.set(event.model, (modelCounts.get(event.model) || 0) + 1);
    });

    const topProviders = Array.from(providerCounts.entries())
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count);

    const topModels = Array.from(modelCounts.entries())
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRequests,
      totalTokens,
      totalCost,
      averageLatency: avgLatency,
      successRate,
      topProviders,
      topModels,
    };
  }
}
