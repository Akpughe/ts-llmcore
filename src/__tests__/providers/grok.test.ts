import { GrokProvider } from "../../providers/grok";
import type { ChatRequest, Message, GrokConfig } from "../../types";
import axios from "axios";

// Mock axios completely
jest.mock("axios", () => ({
  create: jest.fn(),
  isAxiosError: jest.fn(),
}));

const mockedAxios = jest.mocked(axios);

describe("GrokProvider", () => {
  const mockConfig: GrokConfig = {
    apiKey: "grok-test123",
    baseURL: "https://api.x.ai/v1",
  };

  const mockMessages: Message[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ];

  const mockRequest: ChatRequest = {
    messages: mockMessages,
    model: "grok-beta",
    provider: "grok",
  };

  let provider: GrokProvider;
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

    provider = new GrokProvider(mockConfig);
  });

  describe("chat", () => {
    it("should send chat request successfully", async () => {
      const mockResponse = {
        data: {
          id: "test-id",
          object: "chat.completion",
          created: Date.now(),
          model: "grok-beta",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from Grok!",
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
      expect(response.provider).toBe("grok");
      expect(response.message.content).toBe("Hello from Grok!");
      expect(response.finishReason).toBe("stop");
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
        provider: "grok",
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
        provider: "grok",
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
                'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"grok-beta","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n'
              )
            );
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"grok-beta","choices":[{"index":0,"delta":{"content":" from"},"finish_reason":null}]}\n\n'
              )
            );
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"grok-beta","choices":[{"index":0,"delta":{"content":" Grok!"},"finish_reason":"stop"}]}\n\n'
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
        provider: "grok",
      });
    });
  });

  describe("getModels", () => {
    it("should return available models", async () => {
      const response = await provider.getModels();
      expect(response.provider).toBe("grok");
      expect(response.models.length).toBe(2);
      expect(response.models[0].id).toBe("grok-beta");
      expect(response.models[0]).toHaveProperty("pricing");
      expect(response.models[0]).toHaveProperty("capabilities");
      expect(response.models[1].id).toBe("grok-vision-beta");
      expect(response.models[1].capabilities.vision).toBe(true);
    });

    // Note: GrokProvider getModels() returns static data, doesn't make HTTP requests
    // So we don't test HTTP error scenarios for this method
  });

  describe("estimateCost", () => {
    it("should estimate request cost", async () => {
      const cost = await provider.estimateCost(mockRequest);
      expect(typeof cost).toBe("number");
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe("getHealth", () => {
    it("should check provider health", async () => {
      // GrokProvider getModels() always succeeds (static data), so health check succeeds
      const health = await provider.getHealth();
      expect(health.status).toBe("active");
      expect(health.latency).toBeGreaterThanOrEqual(0); // Can be 0 for fast static operations
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    // Note: Since GrokProvider getModels() doesn't make HTTP requests,
    // getHealth() (which calls getModels()) will always succeed
    // To test error scenarios, we'd need to mock the getModels method directly
    it("should handle getModels method errors", async () => {
      // Spy on the provider's getModels method and make it throw
      const getModelsSpy = jest
        .spyOn(provider, "getModels")
        .mockRejectedValue(new Error("Method failed"));

      const health = await provider.getHealth();
      expect(health.status).toBe("error");
      expect(health.error).toBeDefined();

      // Restore the original method
      getModelsSpy.mockRestore();
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
        provider: "grok",
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
        provider: "grok",
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
        message: "Grok server error",
        provider: "grok",
        retryable: true,
      });
    });
  });
});
