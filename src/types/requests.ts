/**
 * Request type definitions for LLMCore package
 */

import type { ProviderName, ModelName } from "./providers";
import type { Message, Tool } from "./messages";

// Base chat request interface
export interface BaseChatRequest {
  provider: ProviderName;
  model: ModelName;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  seed?: number;
  tools?: Tool[];
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; function: { name: string } };
  responseFormat?: ResponseFormat;
  user?: string;
  metadata?: Record<string, unknown>;
}

// Response format options
export interface ResponseFormat {
  type: "text" | "json_object";
  schema?: Record<string, unknown>;
}

// Chat completion request (unified interface)
export interface ChatRequest extends BaseChatRequest {
  // Provider-specific overrides
  providerOptions?: Record<string, unknown>;
}

// Provider-specific request options
export interface OpenAIRequestOptions {
  organization?: string;
  project?: string;
  logprobs?: boolean;
  topLogprobs?: number;
  n?: number;
  suffix?: string;
  echo?: boolean;
  logitBias?: Record<string, number>;
}

export interface ClaudeRequestOptions {
  version?: string;
  topK?: number;
  anthropicVersion?: string;
  anthropicBeta?: string[];
}

export interface GroqRequestOptions {
  logprobs?: boolean;
  topLogprobs?: number;
  n?: number;
}

export interface GrokRequestOptions {
  // Grok-specific options (to be updated based on actual API)
  model_version?: string;
}

// Union type for provider options
export type ProviderOptions =
  | OpenAIRequestOptions
  | ClaudeRequestOptions
  | GroqRequestOptions
  | GrokRequestOptions;

// Request validation result
export interface RequestValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedRequest?: ChatRequest;
}
