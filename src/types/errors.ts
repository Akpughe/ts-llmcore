/**
 * Error type definitions for LLMCore package
 */

import type { ProviderName } from "./providers";

// Base error interface
export interface BaseError {
  name: string;
  message: string;
  code: string;
  provider?: ProviderName;
  statusCode?: number;
  retryable?: boolean;
  timestamp: number;
  details?: Record<string, unknown>;
}

// Error types
export type ErrorType =
  | "authentication"
  | "authorization"
  | "rate_limit"
  | "quota_exceeded"
  | "model_not_found"
  | "invalid_request"
  | "validation"
  | "network"
  | "timeout"
  | "server_error"
  | "service_unavailable"
  | "configuration"
  | "parsing"
  | "unknown";

// LLMCore specific errors
export interface LLMCoreError extends BaseError {
  type: ErrorType;
  requestId?: string;
  model?: string;
  context?: ErrorContext;
}

// Error context for debugging
export interface ErrorContext {
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  stackTrace?: string;
  userAgent?: string;
  attemptNumber?: number;
  totalAttempts?: number;
}

// Authentication errors
export interface AuthenticationError extends LLMCoreError {
  type: "authentication";
  code: "INVALID_API_KEY" | "MISSING_API_KEY" | "EXPIRED_API_KEY";
}

// Authorization errors
export interface AuthorizationError extends LLMCoreError {
  type: "authorization";
  code: "INSUFFICIENT_PERMISSIONS" | "ACCESS_DENIED" | "RESOURCE_FORBIDDEN";
}

// Rate limit errors
export interface RateLimitError extends LLMCoreError {
  type: "rate_limit";
  code: "RATE_LIMIT_EXCEEDED" | "TOO_MANY_REQUESTS";
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  resetTime?: number;
}

// Quota errors
export interface QuotaError extends LLMCoreError {
  type: "quota_exceeded";
  code: "QUOTA_EXCEEDED" | "USAGE_LIMIT_REACHED" | "BILLING_REQUIRED";
  quotaType?: "tokens" | "requests" | "cost";
  usage?: number;
  limit?: number;
}

// Model errors
export interface ModelError extends LLMCoreError {
  type: "model_not_found";
  code: "MODEL_NOT_FOUND" | "MODEL_UNAVAILABLE" | "MODEL_DEPRECATED";
  availableModels?: string[];
}

// Validation errors
export interface ValidationError extends LLMCoreError {
  type: "validation";
  code: "INVALID_PARAMETER" | "MISSING_PARAMETER" | "PARAMETER_OUT_OF_RANGE";
  parameter?: string;
  expectedType?: string;
  actualValue?: unknown;
  constraints?: Record<string, unknown>;
}

// Network errors
export interface NetworkError extends LLMCoreError {
  type: "network";
  code: "CONNECTION_FAILED" | "DNS_RESOLUTION_FAILED" | "SSL_ERROR";
  endpoint?: string;
  timeout?: number;
}

// Timeout errors
export interface TimeoutError extends LLMCoreError {
  type: "timeout";
  code: "REQUEST_TIMEOUT" | "CONNECTION_TIMEOUT" | "READ_TIMEOUT";
  timeoutDuration?: number;
  elapsedTime?: number;
}

// Server errors
export interface ServerError extends LLMCoreError {
  type: "server_error";
  code: "INTERNAL_SERVER_ERROR" | "BAD_GATEWAY" | "SERVICE_ERROR";
  serverMessage?: string;
}

// Service unavailable errors
export interface ServiceUnavailableError extends LLMCoreError {
  type: "service_unavailable";
  code: "SERVICE_UNAVAILABLE" | "MAINTENANCE_MODE" | "OVERLOADED";
  retryAfter?: number;
  estimatedRecovery?: number;
}

// Configuration errors
export interface ConfigurationError extends LLMCoreError {
  type: "configuration";
  code: "INVALID_CONFIG" | "MISSING_CONFIG" | "CONFIG_VALIDATION_FAILED";
  configPath?: string;
  expectedValue?: unknown;
}

// Parsing errors
export interface ParsingError extends LLMCoreError {
  type: "parsing";
  code: "JSON_PARSE_ERROR" | "RESPONSE_PARSE_ERROR" | "INVALID_FORMAT";
  rawData?: string;
  expectedFormat?: string;
}

// Union type for all specific errors
export type SpecificError =
  | AuthenticationError
  | AuthorizationError
  | RateLimitError
  | QuotaError
  | ModelError
  | ValidationError
  | NetworkError
  | TimeoutError
  | ServerError
  | ServiceUnavailableError
  | ConfigurationError
  | ParsingError;

// Error handler function type
export type ErrorHandler = (error: LLMCoreError) => Promise<boolean> | boolean;

// Error recovery strategy
export interface ErrorRecoveryStrategy {
  type: "retry" | "fallback" | "circuit_breaker" | "custom";
  maxAttempts?: number;
  delay?: number;
  backoffMultiplier?: number;
  fallbackProvider?: ProviderName;
  customHandler?: ErrorHandler;
}

// Error classification
export interface ErrorClassification {
  severity: "low" | "medium" | "high" | "critical";
  category: "client" | "server" | "network" | "configuration";
  retryable: boolean;
  userActionRequired: boolean;
  suggestions: string[];
}

// Error reporting configuration
export interface ErrorReporting {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  includeStackTrace?: boolean;
  includeSensitiveData?: boolean;
  batchSize?: number;
  flushInterval?: number;
  filters?: ErrorFilter[];
}

// Error filter
export interface ErrorFilter {
  type: ErrorType;
  codes?: string[];
  providers?: ProviderName[];
  severity?: ErrorClassification["severity"];
  action: "include" | "exclude";
}

// Error statistics
export interface ErrorStats {
  total: number;
  byType: Record<ErrorType, number>;
  byProvider: Record<ProviderName, number>;
  byCode: Record<string, number>;
  recentErrors: LLMCoreError[];
  averageRecoveryTime: number;
}
