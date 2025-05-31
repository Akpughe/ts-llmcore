/**
 * Jest Setup Configuration
 * Global setup for all test files
 */

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeEach(() => {
  // Restore console for each test
  global.console = originalConsole;
});

// Global mocks for external dependencies
jest.mock("axios");

// Custom matchers
expect.extend({
  toBeValidLLMResponse(received) {
    const pass =
      received &&
      typeof received === "object" &&
      received.message &&
      received.provider &&
      received.model &&
      typeof received.created === "number";

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid LLM response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid LLM response`,
        pass: false,
      };
    }
  },

  toBeValidUsageMetrics(received) {
    const pass =
      received &&
      typeof received === "object" &&
      typeof received.promptTokens === "number" &&
      typeof received.completionTokens === "number" &&
      typeof received.totalTokens === "number" &&
      received.totalTokens ===
        received.promptTokens + received.completionTokens;

    if (pass) {
      return {
        message: () => `expected ${received} not to be valid usage metrics`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be valid usage metrics`,
        pass: false,
      };
    }
  },

  toBeValidCostMetrics(received) {
    const pass =
      received &&
      typeof received === "object" &&
      typeof received.totalCost === "number" &&
      received.totalCost >= 0 &&
      received.currency &&
      typeof received.currency === "string";

    if (pass) {
      return {
        message: () => `expected ${received} not to be valid cost metrics`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be valid cost metrics`,
        pass: false,
      };
    }
  },
});

// Global test utilities
global.testUtils = {
  createMockChatRequest: (overrides = {}) => ({
    provider: "openai",
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Test message" }],
    maxTokens: 100,
    ...overrides,
  }),

  createMockChatResponse: (overrides = {}) => ({
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
  }),

  createMockError: (
    type = "network",
    code = "UNKNOWN_ERROR",
    overrides = {}
  ) => ({
    type,
    code,
    message: "Test error message",
    provider: "openai",
    retryable: false,
    timestamp: Date.now(),
    ...overrides,
  }),

  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  mockAxiosResponse: (data, status = 200) => ({
    data,
    status,
    statusText: "OK",
    headers: {},
    config: {},
  }),

  mockAxiosError: (status = 500, data = {}) => {
    const error = new Error("Request failed");
    error.response = {
      status,
      data,
      headers: {},
    };
    error.isAxiosError = true;
    return error;
  },
};

// Environment variable defaults for testing
process.env.NODE_ENV = "test";

// Suppress specific warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && args[0].includes && args[0].includes("Warning:")) {
    return;
  }
  originalWarn.apply(console, args);
};
