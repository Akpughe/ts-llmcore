import { LLMCore } from "../../core/llmcore";
import type { LLMCoreConfig, Message, ChatRequest } from "../../types";
import { ConfigurationManager } from "../../core/config";
import { ProviderRouter } from "../../core/router";

jest.mock("../../core/config");
jest.mock("../../core/router");

describe("LLMCore", () => {
  const validConfig: LLMCoreConfig = {
    providers: {
      openai: {
        apiKey: "sk-test123",
      },
    },
  };

  const mockMessages: Message[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock ConfigurationManager
    (ConfigurationManager as unknown as jest.Mock).mockImplementation(() => ({
      validateConfig: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
        validProviders: ["openai"],
        warnings: [],
      }),
      getProviderConfig: jest.fn().mockReturnValue({ apiKey: "sk-test123" }),
      getDefaultProvider: jest.fn().mockReturnValue("openai"),
      getDefaultModel: jest.fn().mockReturnValue("gpt-4"),
      getRetryConfig: jest.fn().mockReturnValue({
        maxAttempts: 3,
        backoffMultiplier: 2,
        maxDelay: 10000,
      }),
      getTimeout: jest.fn().mockReturnValue(30000),
      getFallbackConfig: jest
        .fn()
        .mockReturnValue({ enabled: true, providers: [] }),
      updateProviderConfig: jest.fn(),
      removeProviderConfig: jest.fn(),
    }));

    // Mock ProviderRouter
    (ProviderRouter as unknown as jest.Mock).mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      chat: jest.fn().mockResolvedValue({
        message: { role: "assistant", content: "Hello!" },
      }),
      chatStream: jest
        .fn()
        .mockResolvedValue({ stream: {}, controller: { abort: jest.fn() } }),
      getModels: jest.fn().mockResolvedValue([]),
      estimateCost: jest.fn().mockResolvedValue(0.01),
      getAvailableProviders: jest.fn().mockReturnValue(["openai"]),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      resetCircuitBreaker: jest.fn(),
      runHealthChecks: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockReturnValue(new Map()),
    }));
  });

  describe("initialization", () => {
    it("should initialize with valid config", async () => {
      const core = new LLMCore(validConfig);
      await core.initialize();
      expect(core.getStatus().isInitialized).toBe(true);
    });

    it("should auto-initialize when enabled", () => {
      const core = new LLMCore(validConfig, { autoInitialize: true });
      expect(core.getStatus().isInitialized).toBe(false); // Async initialization
    });

    it("should not auto-initialize when disabled", () => {
      const core = new LLMCore(validConfig, { autoInitialize: false });
      expect(core.getStatus().isInitialized).toBe(false);
    });
  });

  describe("chat methods", () => {
    let core: LLMCore;

    beforeEach(async () => {
      core = new LLMCore(validConfig, { autoInitialize: false });
      await core.initialize();
    });

    it("should send chat request", async () => {
      const response = await core.chat(mockMessages);
      expect(response).toBeDefined();
    });

    it("should send streaming chat request", async () => {
      const response = await core.chatStream(mockMessages);
      expect(response.stream).toBeDefined();
      expect(response.controller).toBeDefined();
    });

    it("should handle chat errors", async () => {
      const mockError = new Error("Chat failed");
      // Set up the spy before the test
      const chatSpy = jest.spyOn(core["router"], "chat");
      chatSpy.mockRejectedValue(mockError);

      try {
        await core.chat(mockMessages);
        // If we reach here, the error wasn't thrown
        fail("Expected an error to be thrown");
      } catch (error: any) {
        // Check that we got the enhanced error
        expect(error.message).toBe("Chat failed");
        expect(error.provider).toBe("openai");
      }

      // Clean up
      chatSpy.mockRestore();
    });

    it("should handle streaming errors", async () => {
      const mockError = new Error("Stream failed");
      // Set up the spy before the test
      const chatStreamSpy = jest.spyOn(core["router"], "chatStream");
      chatStreamSpy.mockRejectedValue(mockError);

      try {
        await core.chatStream(mockMessages);
        // If we reach here, the error wasn't thrown
        fail("Expected an error to be thrown");
      } catch (error: any) {
        // Check that we got the enhanced error
        expect(error.message).toBe("Stream failed");
        expect(error.provider).toBe("openai");
      }

      // Clean up
      chatStreamSpy.mockRestore();
    });
  });

  describe("utility methods", () => {
    let core: LLMCore;

    beforeEach(async () => {
      core = new LLMCore(validConfig, { autoInitialize: false });
      await core.initialize();
    });

    it("should estimate cost", async () => {
      const cost = await core.estimateCost(mockMessages);
      expect(typeof cost).toBe("number");
    });

    it("should get models", async () => {
      const models = await core.getModels();
      expect(Array.isArray(models)).toBe(true);
    });

    it("should get models for specific provider", async () => {
      const models = await core.getModels("openai");
      expect(Array.isArray(models)).toBe(true);
    });

    it("should complete prompt", async () => {
      const completion = await core.complete("Hello, how are you?");
      expect(typeof completion).toBe("string");
    });

    it("should ask question", async () => {
      const answer = await core.ask("What is 2+2?", "You are a math tutor");
      expect(typeof answer).toBe("string");
    });
  });

  describe("configuration management", () => {
    let core: LLMCore;

    beforeEach(async () => {
      core = new LLMCore(validConfig, { autoInitialize: false });
      await core.initialize();
    });

    it("should update provider config", () => {
      const newConfig = { apiKey: "new-key" };
      core.updateProviderConfig("openai", newConfig);
      expect(core.getStatus().availableProviders).toContain("openai");
    });

    it("should remove provider config", () => {
      // Mock the router to return empty array after removal
      jest.spyOn(core["router"], "getAvailableProviders").mockReturnValue([]);

      core.removeProviderConfig("openai");
      expect(core.getStatus().availableProviders).not.toContain("openai");
    });

    it("should reset circuit breaker", () => {
      expect(() => core.resetCircuitBreaker("openai")).not.toThrow();
    });
  });

  describe("health checks", () => {
    let core: LLMCore;

    beforeEach(async () => {
      core = new LLMCore(validConfig, {
        autoInitialize: false,
        healthCheckInterval: 1000,
      });
      await core.initialize();
    });

    it("should run health checks", async () => {
      await expect(core.runHealthChecks()).resolves.not.toThrow();
    });

    it("should update last health check time", async () => {
      const before = core.getStatus().lastHealthCheck;
      await core.runHealthChecks();
      const after = core.getStatus().lastHealthCheck;
      expect(after).not.toBe(before);
    });
  });

  describe("shutdown", () => {
    let core: LLMCore;

    beforeEach(async () => {
      core = new LLMCore(validConfig, {
        autoInitialize: false,
        healthCheckInterval: 1000,
      });
      await core.initialize();
    });

    it("should shutdown gracefully", async () => {
      await expect(core.shutdown()).resolves.not.toThrow();
    });

    it("should clear health check timer", async () => {
      await core.shutdown();
      expect(core["healthCheckTimer"]).toBeUndefined();
    });
  });

  describe("error handling", () => {
    let core: LLMCore;

    beforeEach(async () => {
      core = new LLMCore(validConfig, { autoInitialize: false });
      await core.initialize();
    });

    it("should enhance errors with request context", async () => {
      const error = new Error("Test error");
      const request: ChatRequest = {
        messages: mockMessages,
        model: "gpt-4",
        provider: "openai",
      };

      const enhanced = core["enhanceError"](error, request);
      expect(enhanced.provider).toBe("openai");
      expect(enhanced.type).toBeDefined();
      expect(enhanced.timestamp).toBeDefined();
    });

    it("should handle uninitialized state", () => {
      const uninitializedCore = new LLMCore(validConfig, {
        autoInitialize: false,
      });
      expect(() => uninitializedCore.chat(mockMessages)).rejects.toThrow();
    });
  });
});
