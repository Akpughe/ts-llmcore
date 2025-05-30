/**
 * Provider type definitions for LLMCore package
 */

// Supported provider names
export type ProviderName = "openai" | "claude" | "groq" | "grok";

// Base provider configuration
export interface BaseProviderConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  retries?: number;
  defaultModel?: string;
}

// OpenAI specific configuration
export interface OpenAIConfig extends BaseProviderConfig {
  organization?: string;
  project?: string;
}

// Claude/Anthropic specific configuration
export interface ClaudeConfig extends BaseProviderConfig {
  version?: string;
}

// Groq specific configuration
export interface GroqConfig extends BaseProviderConfig {
  // Groq-specific settings can be added here
}

// Grok/xAI specific configuration
export interface GrokConfig extends BaseProviderConfig {
  // Grok-specific settings can be added here
}

// Union type for all provider configurations
export type ProviderConfig =
  | OpenAIConfig
  | ClaudeConfig
  | GroqConfig
  | GrokConfig;

// Provider configuration map
export interface ProviderConfigMap {
  openai?: OpenAIConfig;
  claude?: ClaudeConfig;
  groq?: GroqConfig;
  grok?: GrokConfig;
}

// OpenAI Models
export type OpenAIModel =
  | "gpt-4"
  | "gpt-4-turbo-preview"
  | "gpt-4-0125-preview"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-16k";

// Claude Models
export type ClaudeModel =
  | "claude-3-5-sonnet-20241022"
  | "claude-3-opus-20240229"
  | "claude-3-sonnet-20240229"
  | "claude-3-haiku-20240307";

// Groq Models
export type GroqModel =
  | "llama-3.1-70b-versatile"
  | "llama-3.1-8b-instant"
  | "mixtral-8x7b-32768"
  | "gemma-7b-it"
  | "gemma2-9b-it";

// Grok Models
export type GrokModel = "grok-beta" | "grok-vision-beta";

// Union type for all models
export type ModelName = OpenAIModel | ClaudeModel | GroqModel | GrokModel;

// Model mapping by provider
export interface ProviderModels {
  openai: OpenAIModel[];
  claude: ClaudeModel[];
  groq: GroqModel[];
  grok: GrokModel[];
}

// Provider capabilities
export interface ProviderCapabilities {
  streaming: boolean;
  vision: boolean;
  tools: boolean;
  systemMessages: boolean;
  maxTokens: number;
  maxContextLength: number;
}

// Provider information
export interface ProviderInfo {
  name: ProviderName;
  displayName: string;
  description: string;
  website: string;
  capabilities: ProviderCapabilities;
  models: ModelName[];
}

// Provider status
export type ProviderStatus = "active" | "inactive" | "error" | "rate_limited";

// Provider health check result
export interface ProviderHealth {
  status: ProviderStatus;
  latency?: number;
  lastCheck: Date;
  error?: string;
}
