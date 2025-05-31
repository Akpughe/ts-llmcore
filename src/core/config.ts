/**
 * Configuration Manager for LLMCore package
 * Handles provider configuration validation, API key management, and default model selection
 */

import type {
  ProviderName,
  ProviderConfig,
  ModelName,
  OpenAIConfig,
  ClaudeConfig,
  GroqConfig,
  GrokConfig,
  LLMCoreError,
  LLMCoreConfig,
} from "../types/index";

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validProviders: ProviderName[];
  invalidProviders: ProviderName[];
}

export class ConfigurationManager {
  private config: LLMCoreConfig;
  private validationCache = new Map<string, ConfigValidationResult>();

  // Default models for each provider
  private static readonly DEFAULT_MODELS: Record<ProviderName, ModelName> = {
    openai: "gpt-4o-mini",
    claude: "claude-3-haiku-20240307",
    groq: "llama-3.1-8b-instant",
    grok: "grok-beta",
  };

  // Minimum required configuration fields per provider
  private static readonly REQUIRED_FIELDS: Record<ProviderName, string[]> = {
    openai: ["apiKey"],
    claude: ["apiKey"],
    groq: ["apiKey"],
    grok: ["apiKey"],
  };

  constructor(config: LLMCoreConfig) {
    this.config = this.normalizeConfig(config);
  }

  /**
   * Validate the entire configuration
   */
  validateConfig(): ConfigValidationResult {
    const cacheKey = JSON.stringify(this.config);
    const cachedResult = this.validationCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      validProviders: [],
      invalidProviders: [],
    };

    // Validate each provider configuration
    for (const [providerName, providerConfig] of Object.entries(
      this.config.providers
    )) {
      const provider = providerName as ProviderName;

      if (!providerConfig) {
        result.warnings.push(
          `Provider ${provider} is configured but has no settings`
        );
        continue;
      }

      const providerValidation = this.validateProviderConfig(
        provider,
        providerConfig
      );

      if (providerValidation.isValid) {
        result.validProviders.push(provider);
      } else {
        result.invalidProviders.push(provider);
        result.errors.push(
          ...providerValidation.errors.map((e) => `${provider}: ${e}`)
        );
        result.isValid = false;
      }

      result.warnings.push(
        ...providerValidation.warnings.map((w) => `${provider}: ${w}`)
      );
    }

    // Validate default provider
    if (
      this.config.defaultProvider &&
      !result.validProviders.includes(this.config.defaultProvider)
    ) {
      result.errors.push(
        `Default provider '${this.config.defaultProvider}' is not configured or invalid`
      );
      result.isValid = false;
    }

    // Note: Fallback configuration is not part of the current LLMCoreConfig schema
    // Advanced fallback features would need to be added to the types if required

    // Cache the result
    this.validationCache.set(cacheKey, result);

    return result;
  }

  /**
   * Validate a specific provider configuration
   */
  validateProviderConfig(
    provider: ProviderName,
    config: ProviderConfig
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    const requiredFields = ConfigurationManager.REQUIRED_FIELDS[provider];

    // Check required fields
    for (const field of requiredFields) {
      if (!config[field]) {
        result.errors.push(`Missing required field: ${field}`);
        result.isValid = false;
      }
    }

    // Validate API key format
    if (config.apiKey) {
      const apiKeyValidation = this.validateApiKey(provider, config.apiKey);
      if (!apiKeyValidation.isValid) {
        result.errors.push(...apiKeyValidation.errors);
        result.isValid = false;
      }
      result.warnings.push(...apiKeyValidation.warnings);
    }

    // Provider-specific validations
    switch (provider) {
      case "openai":
        this.validateOpenAIConfig(config as OpenAIConfig, result);
        break;
      case "claude":
        this.validateClaudeConfig(config as ClaudeConfig, result);
        break;
      case "groq":
        this.validateGroqConfig(config as GroqConfig, result);
        break;
      case "grok":
        this.validateGrokConfig(config as GrokConfig, result);
        break;
    }

    return result;
  }

  /**
   * Get the default model for a provider
   */
  getDefaultModel(provider: ProviderName): ModelName {
    // Since defaultModels is not in LLMCoreConfig schema, use the static defaults
    return ConfigurationManager.DEFAULT_MODELS[provider];
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): ProviderName {
    // Return the first valid provider if no default is set
    const validation = this.validateConfig();
    if (validation.validProviders.length === 0) {
      throw this.createConfigError(
        "NO_VALID_PROVIDERS",
        "No valid providers configured"
      );
    }

    // Use configured default if valid, otherwise use first valid provider
    if (
      this.config.defaultProvider &&
      validation.validProviders.includes(this.config.defaultProvider)
    ) {
      return this.config.defaultProvider;
    }

    // At this point we know validProviders has at least one element
    return validation.validProviders[0]!; // Non-null assertion since we checked length > 0
  }

  /**
   * Get configuration for a specific provider
   */
  getProviderConfig<T extends ProviderConfig>(provider: ProviderName): T {
    const config = this.config.providers[provider];
    if (!config) {
      throw this.createConfigError(
        "PROVIDER_NOT_CONFIGURED",
        `Provider ${provider} is not configured`
      );
    }
    return config as T;
  }

  /**
   * Get retry configuration
   */
  getRetryConfig(): {
    maxAttempts: number;
    backoffMultiplier: number;
    maxDelay: number;
  } {
    return {
      maxAttempts: this.config.globalSettings?.retries || 3,
      backoffMultiplier: 2, // Not configurable in current schema
      maxDelay: this.config.globalSettings?.retryDelay
        ? this.config.globalSettings.retryDelay * 10
        : 30000,
    };
  }

  /**
   * Get fallback configuration
   */
  getFallbackConfig(): { enabled: boolean; providers: never[] } {
    return {
      enabled: this.config.features?.retries || false,
      providers: [], // Not directly supported in current schema
    };
  }

  /**
   * Get global timeout
   */
  getTimeout(): number {
    return this.config.globalSettings?.timeout || 30000;
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(provider: ProviderName, config: ProviderConfig): void {
    this.config.providers[provider] = config;
    this.validationCache.clear(); // Clear cache when config changes
  }

  /**
   * Remove provider configuration
   */
  removeProviderConfig(provider: ProviderName): void {
    delete this.config.providers[provider];
    this.validationCache.clear();
  }

  private normalizeConfig(config: LLMCoreConfig): LLMCoreConfig {
    return {
      ...config,
      providers: config.providers || {},
      globalSettings: {
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        ...config.globalSettings,
      },
      features: {
        streaming: true,
        tools: true,
        vision: true,
        costTracking: true,
        retries: true,
        ...config.features,
      },
    };
  }

  private validateApiKey(
    provider: ProviderName,
    apiKey: string
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Basic validation
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      result.errors.push("API key must be a non-empty string");
      result.isValid = false;
      return result;
    }

    // Provider-specific API key format validation
    switch (provider) {
      case "openai":
        if (!apiKey.startsWith("sk-")) {
          result.warnings.push('OpenAI API keys typically start with "sk-"');
        }
        if (apiKey.length < 40) {
          result.warnings.push("OpenAI API key seems too short");
        }
        break;

      case "claude":
        if (!apiKey.startsWith("sk-ant-")) {
          result.warnings.push(
            'Claude API keys typically start with "sk-ant-"'
          );
        }
        break;

      case "groq":
        if (apiKey.startsWith("gsk_")) {
          // New format
        } else if (!apiKey.match(/^[a-zA-Z0-9_-]+$/)) {
          result.warnings.push("Groq API key format may be invalid");
        }
        break;

      case "grok":
        // Grok API key validation can be added when format is known
        if (apiKey.length < 20) {
          result.warnings.push("Grok API key seems too short");
        }
        break;
    }

    return result;
  }

  private validateOpenAIConfig(
    config: OpenAIConfig,
    result: { errors: string[]; warnings: string[] }
  ): void {
    if (config.baseURL && !this.isValidUrl(config.baseURL)) {
      result.errors.push("Invalid base URL format");
    }

    if (config.organization && typeof config.organization !== "string") {
      result.errors.push("Organization must be a string");
    }

    if (config.project && typeof config.project !== "string") {
      result.errors.push("Project must be a string");
    }
  }

  private validateClaudeConfig(
    config: ClaudeConfig,
    result: { errors: string[]; warnings: string[] }
  ): void {
    if (config.baseURL && !this.isValidUrl(config.baseURL)) {
      result.errors.push("Invalid base URL format");
    }

    if (config.version && !config.version.match(/^\d{4}-\d{2}-\d{2}$/)) {
      result.warnings.push("Claude version should be in YYYY-MM-DD format");
    }
  }

  private validateGroqConfig(
    config: GroqConfig,
    result: { errors: string[]; warnings: string[] }
  ): void {
    if (config.baseURL && !this.isValidUrl(config.baseURL)) {
      result.errors.push("Invalid base URL format");
    }
  }

  private validateGrokConfig(
    config: GrokConfig,
    result: { errors: string[]; warnings: string[] }
  ): void {
    if (config.baseURL && !this.isValidUrl(config.baseURL)) {
      result.errors.push("Invalid base URL format");
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private createConfigError(code: string, message: string): LLMCoreError {
    return {
      name: "LLMCoreError",
      type: "validation",
      code,
      message,
      provider: "core" as any,
      retryable: false,
      timestamp: Date.now(),
    };
  }
}
