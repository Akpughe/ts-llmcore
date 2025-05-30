/**
 * Configuration type definitions for LLMCore package
 */

import type { ProviderConfigMap, ProviderName } from "./providers";

// Main LLMCore configuration
export interface LLMCoreConfig {
  providers: ProviderConfigMap;
  defaultProvider?: ProviderName;
  globalSettings?: GlobalSettings;
  features?: FeatureConfig;
  logging?: LoggingConfig;
  analytics?: AnalyticsConfig;
  cache?: CacheConfig;
  rateLimiting?: RateLimitConfig;
}

// Global settings that apply across all providers
export interface GlobalSettings {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  maxConcurrentRequests?: number;
  userAgent?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

// Feature configuration
export interface FeatureConfig {
  streaming?: boolean;
  tools?: boolean;
  vision?: boolean;
  costTracking?: boolean;
  analytics?: boolean;
  caching?: boolean;
  rateLimiting?: boolean;
  retries?: boolean;
}

// Logging configuration
export interface LoggingConfig {
  enabled: boolean;
  level: LogLevel;
  format: LogFormat;
  destinations: LogDestination[];
  includeRequestData?: boolean;
  includeResponseData?: boolean;
  maskSensitiveData?: boolean;
  maxLogSize?: number;
  retention?: RetentionConfig;
}

// Log levels
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

// Log formats
export type LogFormat = "json" | "text" | "structured";

// Log destinations
export interface LogDestination {
  type: "console" | "file" | "http" | "stream";
  config?: Record<string, unknown>;
}

// Log retention configuration
export interface RetentionConfig {
  maxFiles?: number;
  maxAge?: string; // e.g., '7d', '30d', '1y'
  maxSize?: string; // e.g., '100MB', '1GB'
}

// Analytics configuration
export interface AnalyticsConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  trackUsage?: boolean;
  trackCosts?: boolean;
  trackLatency?: boolean;
  trackErrors?: boolean;
  batchSize?: number;
  flushInterval?: number;
}

// Cache configuration
export interface CacheConfig {
  enabled: boolean;
  type: CacheType;
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum cache size
  keyPrefix?: string;
  config?: Record<string, unknown>; // Cache-specific configuration
}

// Cache types
export type CacheType = "memory" | "redis" | "file" | "custom";

// Rate limiting configuration
export interface RateLimitConfig {
  enabled: boolean;
  global?: RateLimitRule;
  perProvider?: Record<ProviderName, RateLimitRule>;
  perModel?: Record<string, RateLimitRule>;
  strategy: RateLimitStrategy;
}

// Rate limit rule
export interface RateLimitRule {
  requests: number;
  window: number; // Time window in seconds
  burst?: number; // Allow burst requests
  queue?: boolean; // Queue requests when limit reached
}

// Rate limiting strategies
export type RateLimitStrategy =
  | "fixed_window"
  | "sliding_window"
  | "token_bucket";

// Runtime configuration (can be updated at runtime)
export interface RuntimeConfig {
  defaultProvider?: ProviderName;
  globalSettings?: Partial<GlobalSettings>;
  features?: Partial<FeatureConfig>;
  logging?: Partial<LoggingConfig>;
}

// Configuration validation result
export interface ConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingProviders: ProviderName[];
}

// Environment variable mapping
export interface EnvConfig {
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  GROQ_API_KEY?: string;
  GROK_API_KEY?: string;
  LLMCORE_DEFAULT_PROVIDER?: ProviderName;
  LLMCORE_LOG_LEVEL?: LogLevel;
  LLMCORE_ENABLE_ANALYTICS?: string;
  LLMCORE_ENABLE_CACHING?: string;
}
