/**
 * Unit tests for OpenAI Provider
 */

import { OpenAIProvider } from "../../providers/openai";
import type { ChatRequest, OpenAIConfig } from "../../types/index";
import axios from "axios";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;
  let mockConfig: OpenAIConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      provider: "openai",
      apiKey: "test-api-key",
      baseURL: "https://api.openai.com/v1",
      timeout: 30000,
    };

    // Mock axios.create
    const mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    provider = new OpenAIProvider(mockConfig);
  });

  describe("constructor", () => {
    it("should initialize with correct configuration", () => {
      expect(provider.name).toBe("openai");
      expect(provider.displayName).toBe("OpenAI");
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.baseURL,
        headers: {
          Authorization: `Bearer ${mockConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: mockConfig.timeout,
      });
    });

    it("should use default baseURL if not provided", () => {
      const configWithoutURL = { ...mockConfig };
      delete configWithoutURL.baseURL;

      new OpenAIProvider(configWithoutURL);

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://api.openai.com/v1",
        })
      );
    });
  });

  describe("chat", () => {
    it("should make successful chat completion request", async () => {
      const mockRequest: ChatRequest = {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello, world!" }],
        maxTokens: 150,
        temperature: 0.7,
      };

      const mockOpenAIResponse = {
        data: {
          id: "chatcmpl-123",
          object: "chat.completion",
          created: 1677652288,
          model: "gpt-4",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello! How can I help you today?",
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 12,
            total_tokens: 21,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockResolvedValue(
        mockOpenAIResponse
      );

      const response = await provider.chat(mockRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/chat/completions",
        expect.objectContaining({
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello, world!" }],
          max_tokens: 150,
          temperature: 0.7,
        })
      );

      expect(response).toMatchObject({
        id: "chatcmpl-123",
        provider: "openai",
        model: "gpt-4",
        message: {
          role: "assistant",
          content: "Hello! How can I help you today?",
        },
        finishReason: "stop",
        usage: {
          promptTokens: 9,
          completionTokens: 12,
          totalTokens: 21,
        },
      });
    });

    it("should handle API errors correctly", async () => {
      const mockRequest: ChatRequest = {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const mockError = {
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

      // Mock axios.isAxiosError to return true for our mock error
      jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "authentication",
        code: "INVALID_API_KEY",
        message: "Invalid API key provided",
      });
    });

    it("should handle rate limit errors", async () => {
      const mockRequest: ChatRequest = {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const mockError = {
        isAxiosError: true,
        response: {
          status: 429,
          data: {
            error: {
              message: "Rate limit exceeded",
              type: "rate_limit_error",
            },
          },
          headers: {
            "retry-after": "60",
          },
        },
      };

      // Mock axios.isAxiosError to return true for our mock error
      jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "rate_limit",
        code: "RATE_LIMIT_EXCEEDED",
        retryable: true,
      });
    });
  });

  describe("getModels", () => {
    it("should return supported models", async () => {
      const mockModelsResponse = {
        data: {
          object: "list",
          data: [
            {
              id: "gpt-4",
              object: "model",
              created: 1687882411,
              owned_by: "openai",
            },
            {
              id: "gpt-3.5-turbo",
              object: "model",
              created: 1677610602,
              owned_by: "openai",
            },
          ],
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.get as jest.Mock).mockResolvedValue(
        mockModelsResponse
      );

      const response = await provider.getModels();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/models");
      expect(response.provider).toBe("openai");
      expect(response.models).toHaveLength(2);
      expect(response.models[0]).toMatchObject({
        id: "gpt-4",
        name: "gpt-4",
        capabilities: expect.objectContaining({
          streaming: true,
          tools: true,
        }),
      });
    });
  });

  describe("estimateCost", () => {
    it("should estimate cost correctly for GPT-4", async () => {
      const mockRequest: ChatRequest = {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello, world!" }],
        maxTokens: 150,
      };

      const cost = await provider.estimateCost(mockRequest);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });

    it("should return 0 for unknown models", async () => {
      const mockRequest: ChatRequest = {
        provider: "openai",
        model: "unknown-model" as any,
        messages: [{ role: "user", content: "Hello" }],
      };

      const cost = await provider.estimateCost(mockRequest);
      expect(cost).toBe(0);
    });
  });

  describe("chatStream", () => {
    it("should create streaming response", async () => {
      const mockRequest: ChatRequest = {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const mockStreamResponse = {
        data: {
          pipe: jest.fn(),
          on: jest.fn(),
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockResolvedValue(
        mockStreamResponse
      );

      const streamResponse = await provider.chatStream(mockRequest);

      expect(streamResponse).toHaveProperty("stream");
      expect(streamResponse).toHaveProperty("controller");
      expect(streamResponse).toHaveProperty("metadata");
      expect(streamResponse.metadata.provider).toBe("openai");
    });
  });
});
