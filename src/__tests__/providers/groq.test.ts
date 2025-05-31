import { GroqProvider } from "../../providers/groq";
import type { ChatRequest, Message, GroqConfig, ModelName } from "../../types";
import axios from "axios";

// Mock axios completely
jest.mock("axios", () => ({
  create: jest.fn(),
  isAxiosError: jest.fn(),
}));

const mockedAxios = jest.mocked(axios);

describe("GroqProvider", () => {
  const mockConfig: GroqConfig = {
    apiKey: "groq-test123",
    baseURL: "https://api.groq.com/openai/v1",
  };

  const mockMessages: Message[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ];

  const mockRequest: ChatRequest = {
    messages: mockMessages,
    model: "mixtral-8x7b-32768",
    provider: "groq",
  };

  let provider: GroqProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Mock axios.isAxiosError to return false by default
    mockedAxios.isAxiosError.mockReturnValue(false);

    provider = new GroqProvider(mockConfig);
  });

  describe("chat", () => {
    it("should send chat request successfully", async () => {
      const mockResponse = {
        data: {
          id: "test-id",
          object: "chat.completion",
          created: Date.now(),
          model: "mixtral-8x7b-32768",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from Groq!",
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const response = await provider.chat(mockRequest);
      expect(response.provider).toBe("groq");
      expect(response.message.content).toBe("Hello from Groq!");
      expect(response.finishReason).toBe("stop");
      expect(response.usage?.totalTokens).toBe(15);
    });

    it("should handle API errors", async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              message: "Invalid API key",
            },
          },
        },
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "authentication",
        code: "INVALID_API_KEY",
        message: "Invalid API key provided",
        provider: "groq",
      });
    });

    it("should handle rate limits", async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            error: {
              message: "Rate limit exceeded",
            },
          },
          headers: {
            "retry-after": "60",
          },
        },
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "rate_limit",
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded",
        provider: "groq",
        retryable: true,
      });
    });
  });

  describe("chatStream", () => {
    it("should handle streaming responses", async () => {
      const mockStream = {
        data: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"mixtral-8x7b-32768","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n'
              )
            );
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"mixtral-8x7b-32768","choices":[{"index":0,"delta":{"content":" from"},"finish_reason":null}]}\n\n'
              )
            );
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"mixtral-8x7b-32768","choices":[{"index":0,"delta":{"content":" Groq!"},"finish_reason":"stop"}]}\n\n'
              )
            );
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          },
        }),
      };

      mockAxiosInstance.post.mockResolvedValue(mockStream);

      const response = await provider.chatStream({
        ...mockRequest,
        stream: true,
      });
      expect(response.stream).toBeDefined();
      expect(response.controller).toBeDefined();
    });

    it("should handle streaming errors", async () => {
      const mockError = new Error("Stream error");
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(
        provider.chatStream({ ...mockRequest, stream: true })
      ).rejects.toMatchObject({
        type: "unknown",
        code: "PROVIDER_ERROR",
        message: "Stream error",
        provider: "groq",
      });
    });
  });

  describe("getModels", () => {
    it("should return available models", async () => {
      const mockResponse = {
        data: {
          object: "list",
          data: [
            {
              id: "mixtral-8x7b-32768",
              object: "model",
              created: Date.now(),
              owned_by: "groq",
            },
            {
              id: "llama-3.1-70b-versatile",
              object: "model",
              created: Date.now(),
              owned_by: "groq",
            },
            {
              id: "unsupported-model", // This should be filtered out
              object: "model",
              created: Date.now(),
              owned_by: "groq",
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const response = await provider.getModels();
      expect(response.provider).toBe("groq");
      // Only models with pricing should be returned
      expect(response.models.length).toBe(2);
      expect(response.models[0].id).toBe("mixtral-8x7b-32768");
      expect(response.models[1].id).toBe("llama-3.1-70b-versatile");
      expect(response.models[0]).toHaveProperty("pricing");
      expect(response.models[0]).toHaveProperty("capabilities");
    });

    it("should handle model fetch errors", async () => {
      const mockError = new Error("Failed to fetch models");
      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(provider.getModels()).rejects.toMatchObject({
        type: "unknown",
        code: "PROVIDER_ERROR",
        message: "Failed to fetch models",
        provider: "groq",
      });
    });
  });

  describe("estimateCost", () => {
    it("should estimate request cost", async () => {
      const cost = await provider.estimateCost(mockRequest);
      expect(typeof cost).toBe("number");
      expect(cost).toBeGreaterThan(0);
    });

    it("should estimate cost based on model", async () => {
      const mixtralRequest = {
        ...mockRequest,
        model: "mixtral-8x7b-32768" as ModelName,
      };
      const llamaRequest = {
        ...mockRequest,
        model: "llama-3.1-70b-versatile" as ModelName,
      };

      const mixtralCost = await provider.estimateCost(mixtralRequest);
      const llamaCost = await provider.estimateCost(llamaRequest);

      expect(mixtralCost).not.toBe(llamaCost);
    });
  });

  describe("getHealth", () => {
    it("should check provider health", async () => {
      const mockResponse = {
        data: {
          object: "list",
          data: [], // Empty list but successful response
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const health = await provider.getHealth();
      expect(health.status).toBe("active");
    });

    it("should handle health check errors", async () => {
      const mockError = new Error("Health check failed");
      mockAxiosInstance.get.mockRejectedValue(mockError);

      const health = await provider.getHealth();
      expect(health.status).toBe("error");
      expect(health.error).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      const mockError = {
        code: "ECONNREFUSED",
        message: "Connection refused",
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "network",
        code: "REQUEST_FAILED",
        message: "Connection refused",
        provider: "groq",
      });
    });

    it("should handle timeout errors", async () => {
      const mockError = {
        code: "ETIMEDOUT",
        message: "Request timed out",
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "network",
        code: "REQUEST_FAILED",
        message: "Request timed out",
        provider: "groq",
      });
    });

    it("should handle server errors", async () => {
      const mockError = {
        response: {
          status: 500,
          data: {
            error: {
              message: "Internal server error",
            },
          },
        },
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "server_error",
        code: "SERVER_ERROR",
        message: "Groq server error",
        provider: "groq",
        retryable: true,
      });
    });

    it("should handle malformed responses", async () => {
      const mockResponse = {
        data: {
          id: "test-id",
          object: "chat.completion",
          created: Date.now(),
          model: "mixtral-8x7b-32768",
          choices: [], // Empty choices array should cause error
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await expect(provider.chat(mockRequest)).rejects.toMatchObject({
        type: "parsing",
        code: "NO_CHOICES",
        message: "No choices in response",
        provider: "groq",
      });
    });
  });
});
