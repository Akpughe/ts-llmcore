/**
 * LLMCore - A unified interface for multiple LLM providers
 *
 * @author LLMCore Team
 * @version 1.0.0
 * @license MIT
 */

// LLMCore - Unified TypeScript/JavaScript interface for multiple LLM providers
// Main entry point

// Core classes and interfaces (excluding conflicting types)
export {
  ConfigurationManager,
  ProviderRouter,
  LLMCore,
  type ConfigValidationResult,
  type RouterOptions,
  type ProviderMetrics,
  type LLMCoreOptions,
  type LLMCoreStatus,
} from "./core/index";

// Types and interfaces (with explicit LLMCoreConfig)
export type { LLMCoreConfig } from "./types/config";
export * from "./types/index";

// Provider adapters
export * from "./providers/index";

// Utilities - Phase 4 Advanced Features
export * from "./utils/index";

// Re-export the main class for convenience
export { LLMCore as default } from "./core/llmcore";

// Main LLMCore class (to be implemented)
// export { LLMCore } from './core/LLMCore';

// Utilities (to be implemented)
// export * from './utils/index';
