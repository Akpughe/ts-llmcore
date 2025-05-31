/**
 * Rate Limiting Utilities
 */

import type { ProviderName } from "../types/index";

export interface RateLimit {
  requests: number;
  tokens: number;
  windowMs: number;
  burstAllowance?: number;
}

export interface RateLimitStatus {
  remaining: number;
  resetTime: number;
  retryAfter?: number | undefined;
}

export class RateLimiter {
  private requestCounts = new Map<
    string,
    { count: number; lastReset: number }
  >();
  private tokenCounts = new Map<string, { count: number; lastReset: number }>();

  // Default rate limits for each provider
  private static readonly DEFAULT_LIMITS: Record<ProviderName, RateLimit> = {
    openai: { requests: 10000, tokens: 2000000, windowMs: 60000 }, // per minute
    claude: { requests: 1000, tokens: 4000000, windowMs: 60000 },
    groq: { requests: 30, tokens: 30000, windowMs: 60000 },
    grok: { requests: 1000, tokens: 1000000, windowMs: 60000 },
  };

  checkLimit(
    provider: ProviderName,
    requestTokens: number = 1,
    customLimits?: Partial<RateLimit>
  ): {
    allowed: boolean;
    requestsRemaining: number;
    tokensRemaining: number;
    retryAfter?: number | undefined;
  } {
    const limits = { ...RateLimiter.DEFAULT_LIMITS[provider], ...customLimits };
    const now = Date.now();

    // Check and update request count
    const requestKey = `${provider}-requests`;
    const requestData = this.requestCounts.get(requestKey) || {
      count: 0,
      lastReset: now,
    };

    if (now - requestData.lastReset >= limits.windowMs) {
      requestData.count = 0;
      requestData.lastReset = now;
    }

    // Check and update token count
    const tokenKey = `${provider}-tokens`;
    const tokenData = this.tokenCounts.get(tokenKey) || {
      count: 0,
      lastReset: now,
    };

    if (now - tokenData.lastReset >= limits.windowMs) {
      tokenData.count = 0;
      tokenData.lastReset = now;
    }

    const requestsRemaining = Math.max(0, limits.requests - requestData.count);
    const tokensRemaining = Math.max(0, limits.tokens - tokenData.count);

    const allowed =
      requestData.count < limits.requests &&
      tokenData.count + requestTokens <= limits.tokens;

    if (allowed) {
      requestData.count++;
      tokenData.count += requestTokens;
      this.requestCounts.set(requestKey, requestData);
      this.tokenCounts.set(tokenKey, tokenData);
    }

    const retryAfter = !allowed
      ? Math.ceil(
          (limits.windowMs -
            (now - Math.min(requestData.lastReset, tokenData.lastReset))) /
            1000
        )
      : undefined;

    return {
      allowed,
      requestsRemaining: requestsRemaining - (allowed ? 1 : 0),
      tokensRemaining: tokensRemaining - (allowed ? requestTokens : 0),
      retryAfter,
    };
  }

  async waitForLimit(
    provider: ProviderName,
    requestTokens: number = 1,
    maxWaitMs: number = 60000
  ): Promise<boolean> {
    const check = this.checkLimit(provider, requestTokens);

    if (check.allowed) return true;
    if (!check.retryAfter || check.retryAfter * 1000 > maxWaitMs) return false;

    await new Promise((resolve) =>
      setTimeout(resolve, check.retryAfter! * 1000)
    );
    return this.checkLimit(provider, requestTokens).allowed;
  }
}
