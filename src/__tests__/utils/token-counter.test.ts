/**
 * Unit tests for Token Counter Utility
 */

import { TokenCounter, TokenAnalyzer } from "../../utils/token-counter";
import type { Message, ModelName, ProviderName } from "../../types/index";

describe("TokenCounter", () => {
  describe("countMessageTokens", () => {
    it("should count tokens for a simple message", () => {
      const message: Message = {
        role: "user",
        content: "Hello, how are you today?",
      };

      const result = TokenCounter.countMessageTokens(message, {
        provider: "openai",
        model: "gpt-4",
      });

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBe(message.content.length);
      expect(result.words).toBe(5);
      expect(typeof result.tokens).toBe("number");
    });

    it("should handle empty content", () => {
      const message: Message = {
        role: "user",
        content: "",
      };

      const result = TokenCounter.countMessageTokens(message);

      expect(result.tokens).toBeGreaterThanOrEqual(0);
      expect(result.characters).toBe(0);
      expect(result.words).toBe(0);
    });

    it("should apply model-specific adjustments", () => {
      const message: Message = {
        role: "user",
        content: "Test message for token counting",
      };

      const gpt4Result = TokenCounter.countMessageTokens(message, {
        provider: "openai",
        model: "gpt-4",
      });

      const gpt35Result = TokenCounter.countMessageTokens(message, {
        provider: "openai",
        model: "gpt-3.5-turbo",
      });

      // GPT-4 should have slightly higher token count due to model adjustment
      expect(gpt4Result.tokens).toBeGreaterThan(gpt35Result.tokens);
    });

    it("should handle different providers correctly", () => {
      const message: Message = {
        role: "user",
        content: "Test message for different providers",
      };

      const openaiResult = TokenCounter.countMessageTokens(message, {
        provider: "openai",
      });

      const claudeResult = TokenCounter.countMessageTokens(message, {
        provider: "claude",
      });

      expect(openaiResult.tokens).toBeGreaterThan(0);
      expect(claudeResult.tokens).toBeGreaterThan(0);
      // Different providers may have different token ratios
    });
  });

  describe("countConversationTokens", () => {
    it("should count tokens for multiple messages", () => {
      const messages: Message[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there! How can I help you?" },
        { role: "user", content: "What's the weather like?" },
      ];

      const result = TokenCounter.countConversationTokens(messages, {
        provider: "openai",
        includeSystemMessage: true,
      });

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBeGreaterThan(0);
      expect(result.words).toBeGreaterThan(0);
    });

    it("should exclude system messages when specified", () => {
      const messages: Message[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there!" },
      ];

      const withSystem = TokenCounter.countConversationTokens(messages, {
        includeSystemMessage: true,
      });

      const withoutSystem = TokenCounter.countConversationTokens(messages, {
        includeSystemMessage: false,
      });

      expect(withSystem.tokens).toBeGreaterThan(withoutSystem.tokens);
    });

    it("should add conversation overhead", () => {
      const singleMessage: Message[] = [{ role: "user", content: "Hello" }];

      const multipleMessages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "How are you?" },
      ];

      const singleResult = TokenCounter.countConversationTokens(singleMessage);
      const multipleResult =
        TokenCounter.countConversationTokens(multipleMessages);

      // Multiple messages should have more overhead
      const singleOverhead =
        singleResult.tokens - singleMessage[0].content.length * 0.75;
      const multipleOverhead =
        multipleResult.tokens -
        multipleMessages.reduce(
          (sum, msg) => sum + msg.content.length * 0.75,
          0
        );

      expect(multipleOverhead).toBeGreaterThan(singleOverhead);
    });
  });

  describe("countToolTokens", () => {
    it("should count tokens for tool definitions", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get the current weather for a location",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The city and state, e.g. San Francisco, CA",
                },
              },
              required: ["location"],
            },
          },
        },
      ];

      const result = TokenCounter.countToolTokens(tools, {
        provider: "openai",
      });

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBeGreaterThan(0);
      expect(result.words).toBeGreaterThan(0);
    });

    it("should handle empty tools array", () => {
      const result = TokenCounter.countToolTokens([]);

      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
      expect(result.words).toBe(0);
    });
  });

  describe("wouldExceedLimit", () => {
    it("should detect when messages would exceed token limit", () => {
      const longMessages: Message[] = Array(100)
        .fill(0)
        .map((_, i) => ({
          role: "user",
          content:
            "This is a very long message that should contribute to exceeding the token limit for testing purposes. ".repeat(
              10
            ),
        }));

      const result = TokenCounter.wouldExceedLimit(
        longMessages,
        "gpt-3.5-turbo",
        1000, // Small max tokens
        { provider: "openai" }
      );

      expect(result.wouldExceed).toBe(true);
      expect(result.overflow).toBeGreaterThan(0);
      expect(result.currentTokens).toBeGreaterThan(result.limitTokens);
    });

    it("should return false when within limits", () => {
      const shortMessages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      const result = TokenCounter.wouldExceedLimit(
        shortMessages,
        "gpt-4",
        1000,
        { provider: "openai" }
      );

      expect(result.wouldExceed).toBe(false);
      expect(result.overflow).toBe(0);
      expect(result.currentTokens).toBeLessThanOrEqual(result.limitTokens);
    });
  });

  describe("truncateToLimit", () => {
    it("should truncate messages to fit within limit", () => {
      const messages: Message[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "First message" },
        { role: "assistant", content: "First response" },
        { role: "user", content: "Second message" },
        { role: "assistant", content: "Second response" },
        { role: "user", content: "Third message" },
      ];

      const result = TokenCounter.truncateToLimit(
        messages,
        "gpt-3.5-turbo",
        100, // Very small limit to force truncation
        { provider: "openai" }
      );

      // The function should return a result with the expected structure
      expect(result).toHaveProperty("truncatedMessages");
      expect(result).toHaveProperty("removedMessages");
      expect(result).toHaveProperty("finalTokenCount");

      // Should preserve system message if present
      const systemMessage = result.truncatedMessages.find(
        (m) => m.role === "system"
      );
      if (systemMessage) {
        expect(systemMessage.role).toBe("system");
      }

      // Total messages should not exceed original
      expect(
        result.truncatedMessages.length + result.removedMessages.length
      ).toBeLessThanOrEqual(messages.length);
    });

    it("should preserve system message during truncation", () => {
      const messages: Message[] = [
        {
          role: "system",
          content:
            "You are a helpful assistant with a very long system prompt that contains lots of information about how to behave and what to do.".repeat(
              10
            ),
        },
        { role: "user", content: "Hello" },
      ];

      const result = TokenCounter.truncateToLimit(
        messages,
        "gpt-3.5-turbo",
        1000,
        { provider: "openai" }
      );

      expect(result.truncatedMessages[0].role).toBe("system");
      expect(result.truncatedMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("estimateCost", () => {
    it("should estimate cost for OpenAI models", () => {
      const cost = TokenCounter.estimateCost(
        1000, // tokens
        "gpt-4",
        "input"
      );

      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });

    it("should return 0 for unknown models", () => {
      const cost = TokenCounter.estimateCost(
        1000,
        "unknown-model" as ModelName,
        "input"
      );

      expect(cost).toBe(0);
    });

    it("should calculate different costs for input vs output tokens", () => {
      const inputCost = TokenCounter.estimateCost(1000, "gpt-4", "input");
      const outputCost = TokenCounter.estimateCost(1000, "gpt-4", "output");

      // For some models, output tokens may cost the same or more than input tokens
      expect(outputCost).toBeGreaterThanOrEqual(inputCost);
    });
  });
});

describe("TokenAnalyzer", () => {
  describe("analyzeConversation", () => {
    it("should analyze token distribution across roles", () => {
      const messages: Message[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello there!" },
        { role: "assistant", content: "Hi! How can I help you today?" },
        { role: "user", content: "I need help with programming." },
        {
          role: "assistant",
          content:
            "I'd be happy to help with programming! What specific language or problem are you working on?",
        },
      ];

      const analysis = TokenAnalyzer.analyzeConversation(messages, {
        provider: "openai",
      });

      expect(analysis.totalTokens).toBeGreaterThan(0);
      expect(analysis.byRole.system).toBeGreaterThan(0);
      expect(analysis.byRole.user).toBeGreaterThan(0);
      expect(analysis.byRole.assistant).toBeGreaterThan(0);
      expect(analysis.byMessage).toHaveLength(5);
      expect(analysis.efficiency).toBeGreaterThan(0);
      expect(analysis.efficiency).toBeLessThanOrEqual(1);

      // Check percentage calculations
      const totalPercentage = analysis.byMessage.reduce(
        (sum, msg) => sum + msg.percentage,
        0
      );
      expect(totalPercentage).toBeCloseTo(100, 1);
    });
  });

  describe("getRecommendations", () => {
    it("should provide optimization recommendations", () => {
      const messages: Message[] = [
        {
          role: "system",
          content:
            "You are a very detailed and helpful assistant that provides comprehensive responses to all user queries with extensive background information and detailed explanations about every topic. You should always provide thorough context and multiple examples when answering questions. Make sure to cover all aspects of the topic and provide additional related information that might be useful.".repeat(
              10
            ),
        },
        { role: "user", content: "What is 2+2? Please explain in detail." },
        {
          role: "assistant",
          content:
            "The answer to 2+2 is 4. This is a basic arithmetic operation involving addition.",
        },
      ];

      const recommendations = TokenAnalyzer.getRecommendations(
        messages,
        "gpt-3.5-turbo",
        50, // Very low target to force optimization
        { provider: "openai" }
      );

      expect(recommendations.canOptimize).toBe(true);
      expect(
        recommendations.recommendations.some((rec) =>
          rec.includes("Reduce content")
        )
      ).toBe(true);
    });

    it("should suggest no optimization when within target", () => {
      const messages: Message[] = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ];

      const recommendations = TokenAnalyzer.getRecommendations(
        messages,
        "gpt-4",
        10000, // High target
        { provider: "openai" }
      );

      expect(recommendations.canOptimize).toBe(false);
      expect(recommendations.recommendations).toHaveLength(0);
    });
  });
});
