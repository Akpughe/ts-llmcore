/**
 * Response type definitions for LLMCore package
 */

import type { ProviderName, ModelName } from "./providers";
import type { Message, FinishReason } from "./messages";

// Base response interface
export interface BaseResponse {
  id: string;
  provider: ProviderName;
  model: ModelName;
  created: number;
  usage?: UsageMetrics;
  cost?: CostMetrics;
  latency?: number;
  metadata?: ResponseMetadata;
}

// Chat completion response
export interface ChatResponse extends BaseResponse {
  message: Message;
  finishReason: FinishReason;
  choices?: ChatChoice[];
}

// Individual chat choice (for models that return multiple responses)
export interface ChatChoice {
  index: number;
  message: Message;
  finishReason: FinishReason;
  logprobs?: LogProbabilities;
}

// Streaming chat response
export interface StreamingChatResponse extends BaseResponse {
  delta: MessageDelta;
  finishReason?: FinishReason;
  isComplete: boolean;
}

// Message delta for streaming
export interface MessageDelta {
  role?: string;
  content?: string;
  toolCalls?: ToolCallDelta[];
}

// Tool call delta for streaming
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

// Log probabilities for token analysis
export interface LogProbabilities {
  tokens: string[];
  tokenLogprobs: number[];
  topLogprobs?: Record<string, number>[];
  textOffset?: number[];
}

// Usage metrics
export interface UsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestDuration?: number;
  queueTime?: number;
  processingTime?: number;
}

// Cost metrics
export interface CostMetrics {
  promptCost: number;
  completionCost: number;
  totalCost: number;
  currency: string;
  rateCard?: RateCard;
}

// Rate card for pricing information
export interface RateCard {
  promptTokenPrice: number;
  completionTokenPrice: number;
  currency: string;
  effectiveDate: string;
  source: string;
}

// Response metadata
export interface ResponseMetadata {
  requestId?: string;
  modelVersion?: string;
  region?: string;
  cacheHit?: boolean;
  processingNode?: string;
  retryCount?: number;
  warnings?: string[];
  systemFingerprint?: string;
}

// Error response
export interface ErrorResponse {
  error: {
    type: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable?: boolean;
    statusCode?: number;
  };
  provider: ProviderName;
  requestId?: string;
  timestamp: number;
}

// Health check response
export interface HealthResponse {
  status: "healthy" | "degraded" | "down";
  provider: ProviderName;
  latency: number;
  timestamp: number;
  checks: HealthCheck[];
  version?: string;
}

// Individual health check
export interface HealthCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message?: string;
  duration?: number;
}

// Model list response
export interface ModelsResponse {
  provider: ProviderName;
  models: ModelInfo[];
  timestamp: number;
}

// Model information
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  maxTokens: number;
  pricing?: ModelPricing;
  capabilities: ModelCapabilities;
  status: "active" | "deprecated" | "beta";
  version?: string;
}

// Model pricing
export interface ModelPricing {
  promptTokens: number;
  completionTokens: number;
  currency: string;
  unit: string; // e.g., 'per_1k_tokens'
}

// Model capabilities
export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  json: boolean;
  maxTemperature: number;
  maxTopP: number;
}

// Batch response for multiple requests
export interface BatchResponse<T = ChatResponse> {
  id: string;
  responses: (T | ErrorResponse)[];
  summary: BatchSummary;
  totalCost?: number;
  totalDuration?: number;
}

// Batch summary
export interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  retried: number;
  averageLatency: number;
  totalTokens: number;
}

// Streaming response wrapper
export interface StreamResponse<T> {
  stream: AsyncIterable<T>;
  controller: {
    abort(): void;
    signal: {
      aborted: boolean;
      addEventListener(type: string, listener: () => void): void;
      removeEventListener(type: string, listener: () => void): void;
    };
  };
  metadata: {
    requestId: string;
    provider: ProviderName;
    model: ModelName;
    startTime: number;
  };
}

// Response validation result
export interface ResponseValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  schema?: string;
}
