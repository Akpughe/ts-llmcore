import { ProviderRouter } from "../../core/router";
import type {
  ChatRequest,
  ChatResponse,
  LLMCoreConfig,
  Message,
  ProviderName,
  ModelName,
} from "../../types";
import {
  ConfigurationManager,
  type ConfigValidationResult,
} from "../../core/config";
import { OpenAIProvider } from "../../providers/openai";
import { ClaudeProvider } from "../../providers/claude";

jest.mock("../../core/config");
jest.mock("../../providers/openai");
jest.mock("../../providers/claude");

const MockedConfigurationManager = ConfigurationManager as jest.MockedClass<
  typeof ConfigurationManager
>;

describe("ProviderRouter", () => {
  const mockConfig: LLMCoreConfig = {
    providers: {
      openai: {
        apiKey: "sk-test123",
      },
      claude: {
        apiKey: "sk-ant-test123",
      },
    },
  };

  const mockMessages: Message[] = [{ role: "user", content: "Hello" }];

  const mockRequest: ChatRequest = {
    messages: mockMessages,
    model: "gpt-4" as ModelName,
    provider: "openai" as ProviderName,
  };

  let configManager: jest.Mocked<ConfigurationManager>;
  let router: ProviderRouter;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper mock for ConfigurationManager
    configManager = new MockedConfigurationManager(
      mockConfig
    ) as jest.Mocked<ConfigurationManager>;

    // Mock the validateConfig method to return a proper ConfigValidationResult
    configManager.validateConfig = jest.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      validProviders: ["openai", "claude"] as ProviderName[],
      invalidProviders: [] as ProviderName[],
    } as ConfigValidationResult);

    // Mock other required methods
    configManager.getProviderConfig = jest
      .fn()
      .mockImplementation((provider: ProviderName) => {
        return mockConfig.providers[provider];
      });

    configManager.getDefaultProvider = jest
      .fn()
      .mockReturnValue("openai" as ProviderName);

    // Mock retry configuration
    configManager.getRetryConfig = jest.fn().mockReturnValue({
      maxAttempts: 3,
      backoffMultiplier: 2,
      maxDelay: 30000,
    });

    // Mock timeout configuration
    configManager.getTimeout = jest.fn().mockReturnValue(30000);

    // Mock fallback configuration (default disabled)
    configManager.getFallbackConfig = jest.fn().mockReturnValue({
      enabled: false,
      providers: [],
    });

    // Set up provider mocks with proper name properties
    Object.defineProperty(OpenAIProvider.prototype, "name", {
      value: "openai",
      writable: false,
      configurable: true,
    });
    Object.defineProperty(ClaudeProvider.prototype, "name", {
      value: "claude",
      writable: false,
      configurable: true,
    });

    // Create router with circuit breaker enabled by default
    router = new ProviderRouter(configManager, {
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        resetTimeout: 60000,
      },
      retryDelay: 1000,
    });
  });

  afterEach(async () => {
    // Clear all Jest timers to prevent leaks
    jest.clearAllTimers();
    jest.useRealTimers();

    // Cleanup router resources
    if (router) {
      try {
        await router.destroy();
      } catch (error) {
        console.warn("Error during router cleanup:", error);
      }
    }

    // Clear all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("initialization", () => {
    beforeEach(() => {
      // Reset all provider mocks
      jest.clearAllMocks();
      (OpenAIProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });
      (ClaudeProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });
    });

    it("should initialize providers successfully", async () => {
      await router.initialize();
      expect(router.getAvailableProviders()).toContain("openai");
      expect(router.getAvailableProviders()).toContain("claude");
    });

    it("should handle provider initialization failure", async () => {
      (OpenAIProvider.prototype.getHealth as jest.Mock).mockRejectedValue(
        new Error("Provider initialization failed")
      );
      await router.initialize();
      expect(router.getAvailableProviders()).not.toContain("openai");
      expect(router.getAvailableProviders()).toContain("claude");
    });

    it("should throw if no providers can be initialized", async () => {
      // Set up failing mocks BEFORE creating router
      (OpenAIProvider.prototype.getHealth as jest.Mock).mockRejectedValue(
        new Error("OpenAI initialization failed")
      );
      (ClaudeProvider.prototype.getHealth as jest.Mock).mockRejectedValue(
        new Error("Claude initialization failed")
      );

      // Create a new router instance for this test with failing providers
      const failingRouter = new ProviderRouter(configManager, {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          resetTimeout: 60000,
        },
        retryDelay: 1000,
      });

      await expect(failingRouter.initialize()).rejects.toMatchObject({
        name: "LLMCoreError",
        code: "NO_PROVIDERS_AVAILABLE",
        message: expect.stringContaining("No providers could be initialized"),
      });
    });
  });

  describe("request routing", () => {
    beforeEach(async () => {
      // Reset all provider mocks
      jest.clearAllMocks();
      (OpenAIProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });
      (ClaudeProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });
      await router.initialize();
    });

    it("should route chat request to specified provider", async () => {
      const mockResponse: ChatResponse = {
        id: "test-id",
        provider: "openai" as ProviderName,
        model: "gpt-4" as ModelName,
        created: Date.now(),
        message: { role: "assistant", content: "Hello there!" },
        finishReason: "stop",
      };

      (OpenAIProvider.prototype.chat as jest.Mock).mockResolvedValue(
        mockResponse
      );
      const response = await router.chat(mockRequest);
      expect(response).toEqual(mockResponse);
      expect(OpenAIProvider.prototype.chat).toHaveBeenCalledWith(mockRequest);
    });

    it("should route streaming request to specified provider", async () => {
      const mockStreamResponse = {
        stream: {},
        controller: { abort: jest.fn() },
      };

      (OpenAIProvider.prototype.chatStream as jest.Mock).mockResolvedValue(
        mockStreamResponse
      );
      const response = await router.chatStream({
        ...mockRequest,
        stream: true,
      });
      expect(response).toEqual(mockStreamResponse);
    });

    it("should handle provider not available", async () => {
      // Create a request with an invalid provider and invalid model to prevent model-based fallback
      const request = {
        ...mockRequest,
        provider: "groq" as ProviderName,
        model: "invalid-model" as ModelName, // This will prevent model-based selection
      };

      // Mock getDefaultProvider to throw an error to prevent fallback
      configManager.getDefaultProvider = jest.fn().mockImplementation(() => {
        throw new Error("No default provider");
      });

      // Clear all providers to ensure no "any available provider" fallback
      const testRouter = new ProviderRouter(configManager, {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          resetTimeout: 60000,
        },
        retryDelay: 1000,
      });

      await expect(testRouter.chat(request)).rejects.toMatchObject({
        name: "LLMCoreError",
        code: "NO_PROVIDER_AVAILABLE",
        message: "No suitable provider available for request",
      });
    });
  });

  describe("fallback handling", () => {
    beforeEach(async () => {
      // Reset all provider mocks
      jest.clearAllMocks();
      (OpenAIProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });
      (ClaudeProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });

      // Enable fallback for these tests
      configManager.getFallbackConfig = jest.fn().mockReturnValue({
        enabled: true,
        providers: ["claude"],
      });

      // Create router with fallback enabled
      router = new ProviderRouter(configManager, { enableFallback: true });
      await router.initialize();
    });

    it("should try fallback provider on failure", async () => {
      // Use real timers for this test since it involves retry logic
      jest.useRealTimers();

      // Create a retryable LLMCoreError (server error)
      const mockError = {
        name: "LLMCoreError",
        type: "server_error",
        code: "SERVER_ERROR",
        message: "Provider error",
        provider: "openai",
        retryable: true,
        timestamp: Date.now(),
      };
      (OpenAIProvider.prototype.chat as jest.Mock).mockRejectedValue(mockError);

      const mockResponse: ChatResponse = {
        id: "test-id",
        provider: "claude" as ProviderName,
        model: "claude-3-haiku-20240307" as ModelName,
        created: Date.now(),
        message: { role: "assistant", content: "Hello from Claude!" },
        finishReason: "stop",
      };
      (ClaudeProvider.prototype.chat as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const response = await router.chat(mockRequest);
      expect(response.provider).toBe("claude");
      expect(OpenAIProvider.prototype.chat).toHaveBeenCalled();
      expect(ClaudeProvider.prototype.chat).toHaveBeenCalled();

      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    it("should not try fallback for non-retryable errors", async () => {
      // Create a non-retryable LLMCoreError (authentication error)
      const mockError = {
        name: "LLMCoreError",
        type: "authentication",
        code: "INVALID_API_KEY",
        message: "Authentication error",
        provider: "openai",
        retryable: false,
        timestamp: Date.now(),
      };
      (OpenAIProvider.prototype.chat as jest.Mock).mockRejectedValue(mockError);

      await expect(router.chat(mockRequest)).rejects.toMatchObject({
        type: "authentication",
        message: "Authentication error",
      });
      expect(ClaudeProvider.prototype.chat).not.toHaveBeenCalled();
    });
  });

  describe("circuit breaker", () => {
    beforeEach(async () => {
      // Reset all provider mocks
      jest.clearAllMocks();
      (OpenAIProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });
      await router.initialize();
    });

    it("should open circuit after failures", async () => {
      // Create a non-retryable error so it fails immediately
      const mockError = {
        name: "LLMCoreError",
        type: "authentication",
        code: "INVALID_API_KEY",
        message: "Provider error",
        provider: "openai",
        retryable: false,
        timestamp: Date.now(),
      };
      (OpenAIProvider.prototype.chat as jest.Mock).mockRejectedValue(mockError);

      // Trigger multiple failures (should fail 5 times to open circuit)
      for (let i = 0; i < 5; i++) {
        try {
          await router.chat(mockRequest);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(router.isProviderAvailable("openai")).toBe(false);
    });

    it("should reset circuit breaker", async () => {
      // Create a non-retryable error so it fails immediately
      const mockError = {
        name: "LLMCoreError",
        type: "authentication",
        code: "INVALID_API_KEY",
        message: "Provider error",
        provider: "openai",
        retryable: false,
        timestamp: Date.now(),
      };
      (OpenAIProvider.prototype.chat as jest.Mock).mockRejectedValue(mockError);

      // Trigger failures (should fail 5 times to open circuit)
      for (let i = 0; i < 5; i++) {
        try {
          await router.chat(mockRequest);
        } catch (error) {
          // Expected to fail
        }
      }

      router.resetCircuitBreaker("openai");
      expect(router.isProviderAvailable("openai")).toBe(true);
    });
  });

  describe("metrics", () => {
    beforeEach(async () => {
      // Reset all provider mocks
      jest.clearAllMocks();
      (OpenAIProvider.prototype.getHealth as jest.Mock).mockResolvedValue({
        status: "active",
        latency: 100,
        lastCheck: new Date(),
      });
      await router.initialize();
    });

    it("should track success metrics", async () => {
      const mockResponse: ChatResponse = {
        id: "test-id",
        provider: "openai" as ProviderName,
        model: "gpt-4" as ModelName,
        created: Date.now(),
        message: { role: "assistant", content: "Hello!" },
        finishReason: "stop",
      };
      (OpenAIProvider.prototype.chat as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const response = await router.chat(mockRequest);
      expect(response).toEqual(mockResponse);

      const metrics = router.getMetrics();
      const openaiMetrics = metrics.get("openai");
      expect(openaiMetrics).toBeDefined();
      expect(openaiMetrics?.requests).toBe(1);
      expect(openaiMetrics?.failures).toBe(0);
      expect(openaiMetrics?.successRate).toBe(1);
    });

    it("should track failure metrics", async () => {
      // Create a non-retryable error so it fails immediately without retries
      const mockError = {
        name: "LLMCoreError",
        type: "authentication",
        code: "INVALID_API_KEY",
        message: "Provider error",
        provider: "openai",
        retryable: false,
        timestamp: Date.now(),
      };
      (OpenAIProvider.prototype.chat as jest.Mock).mockRejectedValue(mockError);

      try {
        await router.chat(mockRequest);
      } catch (error) {
        // Expected to fail
      }

      const metrics = router.getMetrics();
      const openaiMetrics = metrics.get("openai");
      expect(openaiMetrics).toBeDefined();
      expect(openaiMetrics?.requests).toBe(1);
      expect(openaiMetrics?.failures).toBe(1);
      expect(openaiMetrics?.successRate).toBe(0);
    });
  });
});
