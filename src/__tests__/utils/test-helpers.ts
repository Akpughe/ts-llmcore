/**
 * Comprehensive test utilities for LLMCore testing
 */

import type {
  ChatRequest,
  ChatResponse,
  ProviderName,
  Message,
  UsageMetrics,
} from "../../types";

// Mock factory for axios instances
export const createMockAxiosInstance = () => ({
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
});

// Standard test data factories
export const createTestChatRequest = (
  overrides: Partial<ChatRequest> = {}
): ChatRequest => ({
  provider: "openai",
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Test message" }],
  maxTokens: 100,
  temperature: 0.7,
  ...overrides,
});

export const createTestChatResponse = (
  overrides: Partial<ChatResponse> = {}
): ChatResponse => ({
  id: "test-response-id",
  provider: "openai",
  model: "gpt-3.5-turbo",
  created: Date.now(),
  message: {
    role: "assistant",
    content: "Test response content",
  },
  finishReason: "stop",
  usage: {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  },
  ...overrides,
});

export const createTestUsageMetrics = (
  overrides: Partial<UsageMetrics> = {}
): UsageMetrics => ({
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
  ...overrides,
});

// Error testing utilities
export const createMockAxiosError = (
  status: number,
  data: any = {},
  headers: Record<string, string> = {}
) => {
  const error = new Error("Request failed") as any;
  error.response = {
    status,
    data,
    headers,
  };
  error.isAxiosError = true;
  return error;
};

export const createMockNetworkError = (code: string, message: string) => {
  const error = new Error(message) as any;
  error.code = code;
  error.isAxiosError = true;
  return error;
};

// LLMCoreError assertion helpers
export const expectLLMCoreError = (
  error: any,
  expectedType: string,
  expectedCode: string,
  expectedProvider: ProviderName
) => {
  expect(error).toMatchObject({
    name: "LLMCoreError",
    type: expectedType,
    code: expectedCode,
    provider: expectedProvider,
    timestamp: expect.any(Number),
  });
};

// Test environment utilities
export const isCI = (): boolean => {
  return (
    process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true"
  );
};

export const skipInCI = (reason: string = "Skipped in CI environment") => {
  if (isCI()) {
    return { skip: true, reason };
  }
  return { skip: false };
};

// Async testing utilities
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Mock data generators
export const generateRandomString = (length: number = 10): string => {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
};

export const generateMockMessages = (count: number): Message[] => {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `Test message ${i + 1}: ${generateRandomString()}`,
  }));
};
