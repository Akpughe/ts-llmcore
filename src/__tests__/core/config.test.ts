import { ConfigurationManager } from "../../core/config";
import type { LLMCoreConfig, ProviderName } from "../../types";

describe("ConfigurationManager", () => {
  const validConfig: LLMCoreConfig = {
    providers: {
      openai: {
        apiKey: "sk-test123",
        baseURL: "https://api.openai.com/v1",
        organization: "org-123",
      },
      claude: {
        apiKey: "sk-ant-test123",
        baseURL: "https://api.anthropic.com",
        version: "2024-01-01",
      },
    },
    defaultProvider: "openai",
    globalSettings: {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
    },
    features: {
      streaming: true,
      tools: true,
      vision: true,
      costTracking: true,
      retries: true,
    },
  };

  describe("constructor and validation", () => {
    it("should create instance with valid config", () => {
      const config = new ConfigurationManager(validConfig);
      const validation = config.validateConfig();
      expect(validation.isValid).toBe(true);
      expect(validation.validProviders).toContain("openai");
      expect(validation.validProviders).toContain("claude");
      expect(validation.errors).toHaveLength(0);
    });

    it("should handle missing providers", () => {
      const config = new ConfigurationManager({ providers: {} });
      const validation = config.validateConfig();
      expect(validation.isValid).toBe(true);
      expect(validation.validProviders).toHaveLength(0);
      expect(validation.errors).toHaveLength(0);
    });

    it("should validate API key format", () => {
      const invalidConfig = {
        ...validConfig,
        providers: {
          openai: { apiKey: "" },
        },
      };
      const config = new ConfigurationManager(invalidConfig);
      const validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "openai: Missing required field: apiKey"
      );
    });
  });

  describe("provider configuration", () => {
    const config = new ConfigurationManager(validConfig);

    it("should get default provider", () => {
      expect(config.getDefaultProvider()).toBe("openai");
    });

    it("should get provider config", () => {
      const openaiConfig = config.getProviderConfig("openai");
      expect(openaiConfig.apiKey).toBe("sk-test123");
      expect(openaiConfig.baseURL).toBe("https://api.openai.com/v1");
    });

    it("should throw on invalid provider", () => {
      expect(() =>
        config.getProviderConfig("invalid" as ProviderName)
      ).toThrow();
    });

    it("should update provider config", () => {
      config.updateProviderConfig("openai", {
        apiKey: "sk-newkey",
        baseURL: "https://custom.openai.com",
      });
      const newConfig = config.getProviderConfig("openai");
      expect(newConfig.apiKey).toBe("sk-newkey");
      expect(newConfig.baseURL).toBe("https://custom.openai.com");
    });

    it("should remove provider config", () => {
      config.removeProviderConfig("claude");
      expect(() => config.getProviderConfig("claude")).toThrow();
    });
  });

  describe("model configuration", () => {
    const config = new ConfigurationManager(validConfig);

    it("should get default model for provider", () => {
      expect(config.getDefaultModel("openai")).toBe("gpt-4o-mini");
      expect(config.getDefaultModel("claude")).toBe("claude-3-haiku-20240307");
    });
  });

  describe("retry and timeout configuration", () => {
    it("should get default retry config", () => {
      const config = new ConfigurationManager({ providers: {} });
      const retryConfig = config.getRetryConfig();
      expect(retryConfig.maxAttempts).toBe(3);
      expect(retryConfig.backoffMultiplier).toBe(2);
      expect(retryConfig.maxDelay).toBe(10000);
    });

    it("should get custom retry config", () => {
      const config = new ConfigurationManager({
        providers: {},
        globalSettings: { retries: 5, retryDelay: 2000 },
      });
      const retryConfig = config.getRetryConfig();
      expect(retryConfig.maxAttempts).toBe(5);
      expect(retryConfig.maxDelay).toBe(20000);
    });

    it("should get default timeout", () => {
      const config = new ConfigurationManager({ providers: {} });
      expect(config.getTimeout()).toBe(30000);
    });

    it("should get custom timeout", () => {
      const config = new ConfigurationManager({
        providers: {},
        globalSettings: { timeout: 60000 },
      });
      expect(config.getTimeout()).toBe(60000);
    });
  });

  describe("fallback configuration", () => {
    it("should get fallback config", () => {
      const config = new ConfigurationManager({
        providers: {},
        features: { retries: true },
      });
      const fallbackConfig = config.getFallbackConfig();
      expect(fallbackConfig.enabled).toBe(true);
      expect(fallbackConfig.providers).toEqual([]);
    });
  });
});
