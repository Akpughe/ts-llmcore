/**
 * Integration Tests for Provider Adapters
 * Tests real provider functionality with mocked responses
 */

import axios from "axios";
import { OpenAIProvider } from "../../providers/openai";
import { ClaudeProvider } from "../../providers/claude";
import type {
  ChatRequest,
  OpenAIConfig,
  ClaudeConfig,
} from "../../types/index";

describe("Provider Integration Tests", () => {
  describe("OpenAI Provider", () => {
    let provider: OpenAIProvider;
    let config: OpenAIConfig;

    beforeEach(() => {
      config = {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY || "test-key",
        timeout: 30000,
      };
      provider = new OpenAIProvider(config);
    });

    it("should initialize correctly", () => {
      expect(provider.name).toBe("openai");
      expect(provider.displayName).toBe("OpenAI");
    });

    it("should estimate costs for different models", async () => {
      const request: ChatRequest = {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello, world!" }],
        maxTokens: 150,
      };

      const cost = await provider.estimateCost(request);
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(typeof cost).toBe("number");
    });

    it("should get models information", async () => {
      // Mock the axios call since we don't want to make real API calls in tests
      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue({
          data: {
            object: "list",
            data: [
              {
                id: "gpt-4",
                object: "model",
                created: 1687882411,
                owned_by: "openai",
              },
            ],
          },
        }),
      };

      // Replace the client temporarily
      (provider as any).client = mockAxiosInstance;

      const models = await provider.getModels();
      expect(models.provider).toBe("openai");
      expect(models.models).toHaveLength(1);
      expect(models.models[0].id).toBe("gpt-4");
    });
  });

  describe("Claude Provider", () => {
    let provider: ClaudeProvider;
    let config: ClaudeConfig;

    beforeEach(() => {
      config = {
        provider: "claude",
        apiKey: process.env.ANTHROPIC_API_KEY || "test-key",
        timeout: 30000,
      };
      provider = new ClaudeProvider(config);
    });

    it("should initialize correctly", () => {
      expect(provider.name).toBe("claude");
      expect(provider.displayName).toBe("Claude (Anthropic)");
    });

    it("should estimate costs for different models", async () => {
      const request: ChatRequest = {
        provider: "claude",
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "Hello, world!" }],
        maxTokens: 150,
      };

      const cost = await provider.estimateCost(request);
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(typeof cost).toBe("number");
    });

    it("should get supported models", async () => {
      const models = await provider.getModels();
      expect(models.provider).toBe("claude");
      expect(models.models.length).toBeGreaterThan(0);
      expect(models.models[0]).toHaveProperty("id");
      expect(models.models[0]).toHaveProperty("capabilities");
    });
  });

  describe("Provider Comparison", () => {
    let openaiProvider: OpenAIProvider;
    let claudeProvider: ClaudeProvider;

    beforeEach(() => {
      openaiProvider = new OpenAIProvider({
        provider: "openai",
        apiKey: "test-key",
      });

      claudeProvider = new ClaudeProvider({
        provider: "claude",
        apiKey: "test-key",
      });
    });

    it("should provide consistent interface across providers", async () => {
      const providers = [openaiProvider, claudeProvider];

      for (const provider of providers) {
        // Test basic properties
        expect(provider.name).toBeTruthy();
        expect(provider.displayName).toBeTruthy();

        // Test methods exist
        expect(typeof provider.chat).toBe("function");
        expect(typeof provider.chatStream).toBe("function");
        expect(typeof provider.getModels).toBe("function");
        expect(typeof provider.estimateCost).toBe("function");
      }
    });

    it("should handle different request formats correctly", async () => {
      const baseRequest = {
        messages: [{ role: "user" as const, content: "Hello" }],
        maxTokens: 50,
      };

      const openaiRequest: ChatRequest = {
        ...baseRequest,
        provider: "openai",
        model: "gpt-3.5-turbo",
      };

      const claudeRequest: ChatRequest = {
        ...baseRequest,
        provider: "claude",
        model: "claude-3-haiku-20240307",
      };

      // Test cost estimation (doesn't require API calls)
      const openaiCost = await openaiProvider.estimateCost(openaiRequest);
      const claudeCost = await claudeProvider.estimateCost(claudeRequest);

      expect(openaiCost).toBeGreaterThanOrEqual(0);
      expect(claudeCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle network errors consistently", async () => {
      const provider = new OpenAIProvider({
        provider: "openai",
        apiKey: "test-key",
      });

      const request: ChatRequest = {
        provider: "openai",
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
      };

      // Mock a network error
      const networkError = {
        isAxiosError: true,
        code: "ENOTFOUND",
        message: "Network connection failed",
      };

      // Mock axios.isAxiosError to return true
      jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

      // Mock the client to throw network error
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue(networkError),
      };
      (provider as any).client = mockAxiosInstance;

      await expect(provider.chat(request)).rejects.toMatchObject({
        type: expect.stringMatching(/network|server_error/),
        provider: "openai",
        retryable: expect.any(Boolean),
      });
    });

    it("should handle invalid API keys consistently", async () => {
      const provider = new OpenAIProvider({
        provider: "openai",
        apiKey: "invalid-key",
      });

      const request: ChatRequest = {
        provider: "openai",
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
      };

      // Mock an authentication error
      const authError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            error: {
              message: "Invalid API key",
              type: "invalid_request_error",
            },
          },
        },
      };

      // Mock axios.isAxiosError to return true
      jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

      // Mock the client to throw auth error
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue(authError),
      };
      (provider as any).client = mockAxiosInstance;

      await expect(provider.chat(request)).rejects.toMatchObject({
        type: "authentication",
        code: "INVALID_API_KEY",
        provider: "openai",
      });
    });
  });
});
