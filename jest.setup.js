/**
 * Jest Setup Configuration
 * Global setup for all test files
 */

// Polyfill ReadableStream for Node.js testing environment
if (!global.ReadableStream) {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource = {}) {
      this.controller = new global.ReadableStreamDefaultController();
      this.controller._stream = this; // Connect controller to stream
      this.reader = null;
      this.locked = false;
      this._chunks = [];
      this._started = false;
      this._closed = false;
      this._underlyingSource = underlyingSource;

      // Start the stream
      if (underlyingSource.start) {
        underlyingSource.start(this.controller);
      }
    }

    getReader() {
      if (this.locked) {
        throw new TypeError("ReadableStream is locked");
      }
      this.locked = true;

      this.reader = {
        read: async () => {
          if (!this._started && this._underlyingSource.pull) {
            this._started = true;
            await this._underlyingSource.pull(this.controller);
          }

          if (this._chunks.length > 0) {
            return { done: false, value: this._chunks.shift() };
          }

          return { done: true, value: undefined };
        },
        releaseLock: () => {
          this.locked = false;
          this.reader = null;
        },
        cancel: async () => {
          if (this._underlyingSource.cancel) {
            await this._underlyingSource.cancel();
          }
          this._closed = true;
        },
      };

      return this.reader;
    }

    cancel() {
      if (this.reader) {
        return this.reader.cancel();
      }
      return Promise.resolve();
    }

    [Symbol.asyncIterator]() {
      const reader = this.getReader();
      return {
        async next() {
          const result = await reader.read();
          if (result.done) {
            reader.releaseLock();
          }
          return result;
        },
        async return() {
          reader.releaseLock();
          return { done: true, value: undefined };
        },
      };
    }
  };

  global.ReadableStreamDefaultController = class ReadableStreamDefaultController {
    constructor() {
      this.desiredSize = 1;
      this._stream = null;
    }

    enqueue(chunk) {
      if (this._stream && this._stream._chunks) {
        this._stream._chunks.push(chunk);
      }
    }

    close() {
      if (this._stream) {
        this._stream._closed = true;
      }
    }

    error(error) {
      if (this._stream) {
        this._stream._error = error;
      }
    }
  };
}

// Polyfill TextEncoder/TextDecoder for Node.js testing environment
if (!global.TextEncoder) {
  global.TextEncoder = class TextEncoder {
    encode(string) {
      return Buffer.from(string, "utf8");
    }
  };
}

if (!global.TextDecoder) {
  global.TextDecoder = class TextDecoder {
    decode(buffer) {
      return Buffer.from(buffer).toString("utf8");
    }
  };
}

// Global test timeout
jest.setTimeout(10000);

// Initialize global tracking arrays
global.testStreams = [];
global.testResources = [];

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeEach(() => {
  // Restore console for each test
  global.console = originalConsole;
});

afterEach(() => {
  // Clear all timers to prevent leaks
  jest.clearAllTimers();
  jest.useRealTimers();

  // Clear all mocks
  jest.clearAllMocks();

  // Cleanup any global streams or resources
  if (global.testStreams) {
    global.testUtils.cleanupStreams(global.testStreams);
    global.testStreams = [];
  }

  // Clear any global state
  if (global.testResources) {
    global.testResources.forEach((resource) => {
      try {
        if (resource && typeof resource.destroy === "function") {
          resource.destroy();
        } else if (resource && typeof resource.close === "function") {
          resource.close();
        } else if (resource && typeof resource.cancel === "function") {
          resource.cancel();
        }
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    });
    global.testResources = [];
  }

  // Force garbage collection to prevent memory leaks (if available)
  if (global.gc) {
    global.gc();
  }
});

afterAll(() => {
  // Final cleanup - ensure all resources are released
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
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

  createMockStreamResponse: (chunks = ["Hello", " World", "!"]) => {
    return {
      data: new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => {
            const sseData = `data: {"choices":[{"delta":{"content":"${chunk}"}}]}\n\n`;
            controller.enqueue(new TextEncoder().encode(sseData));
          });
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    };
  },

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

  // Streaming utilities
  createMockStreamController: () => {
    const chunks = [];
    const controller = {
      enqueue: (chunk) => chunks.push(chunk),
      close: () => {},
      error: (err) => {},
      getChunks: () => chunks,
    };
    return controller;
  },

  // Cleanup utilities
  cleanupStreams: (streams = []) => {
    streams.forEach((stream) => {
      try {
        if (stream && typeof stream.cancel === "function") {
          stream.cancel();
        }
        if (
          stream &&
          stream.reader &&
          typeof stream.reader.releaseLock === "function"
        ) {
          stream.reader.releaseLock();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  },
};

// Environment variable defaults for testing
process.env.NODE_ENV = "test";

// Suppress specific warnings in tests
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;
const originalLog = console.log;

console.warn = (...args) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("Warning:") ||
      message.includes("watchman warning:") ||
      message.includes("Recrawled this watch") ||
      message.includes("MustScanSubDirs") ||
      message.includes("cleanup") ||
      message.includes("ProviderRouter cleanup"))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

console.info = (...args) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("[LLMCore:INFO]") ||
      message.includes("Initializing LLMCore") ||
      message.includes("LLMCore initialized") ||
      message.includes("Successfully initialized") ||
      message.includes("ProviderRouter cleanup") ||
      message.includes("Shutting down LLMCore") ||
      message.includes("LLMCore shutdown"))
  ) {
    return; // Suppress info logs during tests
  }
  originalInfo.apply(console, args);
};

// Keep errors and other logs as they may be important for debugging
console.error = originalError;
console.log = originalLog;
