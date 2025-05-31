# LLMCore - Unified LLM Provider Interface

![Version](https://img.shields.io/npm/v/llm-core)
![License](https://img.shields.io/npm/l/llm-core)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

A unified, type-safe TypeScript/JavaScript package for interacting with multiple Large Language Model (LLM) providers including OpenAI, Claude (Anthropic), Groq, and Grok.

## 🌟 Features

- **🔄 Unified Interface**: Single API for multiple LLM providers
- **📡 Streaming Support**: Real-time response streaming with robust error handling
- **💰 Cost Tracking**: Built-in token usage and cost estimation
- **🛡️ Type Safety**: Full TypeScript support with comprehensive type definitions
- **⚡ Rate Limiting**: Intelligent rate limiting and retry mechanisms
- **🔧 Provider Switching**: Easy fallback and load balancing between providers
- **📊 Analytics**: Built-in usage analytics and performance monitoring
- **🎛️ Tool Support**: Function/tool calling across compatible providers
- **📝 Rich Configuration**: Flexible configuration with validation

## 🚀 Quick Start

### Installation

```bash
npm install llm-core
# or
yarn add llm-core
# or
pnpm add llm-core
```

### Basic Usage

```typescript
import { LLMCore } from "llm-core";

// Initialize with your API keys
const llm = new LLMCore({
  providers: {
    openai: {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    },
    claude: {
      provider: "claude",
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },
  defaultProvider: "openai",
});

// Make your first request
const response = await llm.chat({
  provider: "openai",
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello, world!" }],
});

console.log(response.message.content);
```

## 📚 Documentation

### Configuration

#### Basic Configuration

```typescript
import { LLMCore, type LLMCoreConfig } from "llm-core";

const config: LLMCoreConfig = {
  providers: {
    openai: {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.openai.com/v1", // optional
      timeout: 30000, // optional
    },
    claude: {
      provider: "claude",
      apiKey: process.env.ANTHROPIC_API_KEY,
      version: "2023-06-01", // optional
    },
    groq: {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
    },
    grok: {
      provider: "grok",
      apiKey: process.env.GROK_API_KEY,
    },
  },
  defaultProvider: "openai",
  features: {
    streaming: true,
    caching: false,
    retries: true,
    analytics: true,
    rateLimiting: true,
  },
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
};

const llm = new LLMCore(config);
```

### Core Methods

#### Chat Completion

```typescript
const response = await llm.chat({
  provider: "openai",
  model: "gpt-4",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain quantum computing in simple terms." },
  ],
  maxTokens: 500,
  temperature: 0.7,
});

console.log(response.message.content);
console.log(`Cost: $${response.cost?.totalCost.toFixed(4)}`);
console.log(`Tokens used: ${response.usage?.totalTokens}`);
```

#### Streaming Responses

```typescript
const streamResponse = await llm.chatStream({
  provider: "claude",
  model: "claude-3-sonnet-20240229",
  messages: [
    { role: "user", content: "Write a short story about space exploration." },
  ],
  maxTokens: 1000,
});

// Process streaming chunks
for await (const chunk of streamResponse.stream) {
  if (chunk.delta.content) {
    process.stdout.write(chunk.delta.content);
  }

  if (chunk.isComplete) {
    console.log("\n\nStream completed!");
    break;
  }
}

// Cancel stream if needed
streamResponse.controller.abort();
```

#### Function/Tool Calling

```typescript
const response = await llm.chat({
  provider: "openai",
  model: "gpt-4",
  messages: [
    { role: "user", content: "What's the weather like in San Francisco?" },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City and state, e.g. San Francisco, CA",
            },
          },
          required: ["location"],
        },
      },
    },
  ],
  toolChoice: "auto",
});

if (response.message.toolCalls) {
  for (const toolCall of response.message.toolCalls) {
    console.log(`Called: ${toolCall.function.name}`);
    console.log(`Arguments: ${toolCall.function.arguments}`);
  }
}
```

### Provider-Specific Usage

#### OpenAI

```typescript
import { OpenAIProvider } from "llm-core";

const openai = new OpenAIProvider({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat({
  provider: "openai",
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
  maxTokens: 100,
});
```

#### Claude (Anthropic)

```typescript
import { ClaudeProvider } from "llm-core";

const claude = new ClaudeProvider({
  provider: "claude",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await claude.chat({
  provider: "claude",
  model: "claude-3-sonnet-20240229",
  messages: [{ role: "user", content: "Explain machine learning" }],
  maxTokens: 500,
});
```

### Utilities

#### Cost Estimation

```typescript
import { CostCalculator } from "llm-core";

// Estimate cost before making request
const estimate = CostCalculator.estimateCost(
  messages,
  "gpt-4",
  "openai",
  500 // expected output tokens
);

console.log(`Estimated cost: $${estimate.estimated.totalCost.toFixed(4)}`);
console.log(`Confidence: ${estimate.confidence}`);

// Compare costs across providers
const comparison = CostCalculator.compareCosts(usage, "gpt-4", [
  "openai",
  "claude",
  "groq",
]);

console.log("Cost comparison:", comparison);
```

#### Token Counting

```typescript
import { TokenCounter } from "llm-core";

const tokenCount = TokenCounter.countConversationTokens(messages, {
  provider: "openai",
  model: "gpt-4",
});

console.log(`Total tokens: ${tokenCount.tokens}`);
console.log(
  `Estimated cost: $${TokenCounter.estimateCost(
    tokenCount.tokens,
    "gpt-4",
    "openai"
  )}`
);

// Check if within limits
const limitCheck = TokenCounter.wouldExceedLimit(
  messages,
  "gpt-4",
  1000 // max tokens for response
);

if (limitCheck.wouldExceed) {
  const truncated = TokenCounter.truncateToLimit(messages, "gpt-4", 1000);
  console.log(`Removed ${truncated.removedMessages.length} messages`);
}
```

#### Streaming Utilities

```typescript
import { StreamUtils } from "llm-core";

// Convert stream to string
const content = await StreamUtils.streamToString(streamResponse.stream);

// Transform stream chunks
const transformedStream = StreamUtils.transformStream(
  streamResponse.stream,
  (chunk, index) => ({
    ...chunk,
    index,
    timestamp: Date.now(),
  })
);

// Monitor stream performance
const monitoredStream = StreamUtils.monitorStream(
  streamResponse.stream,
  (metrics) => {
    console.log(
      `Chunks: ${metrics.chunksReceived}, Latency: ${metrics.avgLatency}ms`
    );
  }
);
```

## 🔧 Advanced Features

### Provider Fallback

```typescript
const llm = new LLMCore({
  providers: {
    primary: { provider: "openai", apiKey: "key1" },
    fallback: { provider: "claude", apiKey: "key2" },
  },
  defaultProvider: "primary",
  features: {
    retries: true,
    // Auto-fallback on provider errors
  },
});
```

### Rate Limiting

```typescript
import { RateLimiter } from "llm-core";

const rateLimiter = new RateLimiter();

// Check rate limits before making requests
const allowed = rateLimiter.checkLimit("openai", 1000); // 1000 tokens

if (allowed.allowed) {
  // Make request
} else {
  console.log(`Rate limited. Retry after: ${allowed.retryAfter}s`);
}
```

### Analytics

```typescript
// Get usage statistics
const stats = llm.getAnalytics().getUsageStats("day");

console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
console.log(`Top provider: ${stats.topProviders[0]?.provider}`);
```

## 📖 Examples

### Chat Application

```typescript
import { LLMCore } from "llm-core";

class ChatBot {
  private llm: LLMCore;
  private conversation: Array<{ role: string; content: string }> = [];

  constructor() {
    this.llm = new LLMCore({
      providers: {
        openai: {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY,
        },
      },
      defaultProvider: "openai",
    });
  }

  async chat(userMessage: string): Promise<string> {
    this.conversation.push({ role: "user", content: userMessage });

    const response = await this.llm.chat({
      provider: "openai",
      model: "gpt-4",
      messages: this.conversation,
      maxTokens: 500,
    });

    this.conversation.push({
      role: "assistant",
      content: response.message.content,
    });

    return response.message.content;
  }
}

const bot = new ChatBot();
const response = await bot.chat("Hello! How are you?");
console.log(response);
```

### Streaming Chat with Cancellation

```typescript
async function streamingChat(prompt: string) {
  const llm = new LLMCore({
    /* config */
  });

  const streamResponse = await llm.chatStream({
    provider: "claude",
    model: "claude-3-sonnet-20240229",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1000,
  });

  let fullResponse = "";
  const timeout = setTimeout(() => {
    streamResponse.controller.abort();
  }, 30000); // Cancel after 30 seconds

  try {
    for await (const chunk of streamResponse.stream) {
      if (chunk.delta.content) {
        fullResponse += chunk.delta.content;
        process.stdout.write(chunk.delta.content);
      }

      if (chunk.isComplete) {
        clearTimeout(timeout);
        break;
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("\nStream was cancelled due to timeout");
    }
  }

  return fullResponse;
}
```

### Cost Optimization

```typescript
import { CostOptimizer, TokenCounter } from "llm-core";

async function optimizedChat(messages: Message[]) {
  // Check if we need to optimize
  const analysis = TokenCounter.wouldExceedLimit(messages, "gpt-4", 1000);

  if (analysis.wouldExceed) {
    // Truncate messages to fit
    const truncated = TokenCounter.truncateToLimit(messages, "gpt-4", 1000);
    messages = truncated.truncatedMessages;
  }

  // Get cost optimization suggestions
  const suggestions = CostOptimizer.getOptimizationSuggestions(
    {
      promptTokens: analysis.currentTokens,
      completionTokens: 500,
      totalTokens: analysis.currentTokens + 500,
    },
    "gpt-4",
    "openai"
  );

  if (suggestions.length > 0) {
    console.log("Cost optimization suggestions:");
    suggestions.forEach((s) =>
      console.log(`- ${s.description} (Save $${s.potentialSavings.toFixed(4)})`)
    );
  }

  // Make the request with cost tracking
  const response = await llm.chat({
    provider: "openai",
    model: "gpt-4",
    messages,
  });

  console.log(`Actual cost: $${response.cost?.totalCost.toFixed(4)}`);
  return response;
}
```

## 🛠️ API Reference

### Core Classes

- **`LLMCore`** - Main class for unified LLM interactions
- **`OpenAIProvider`** - OpenAI-specific provider adapter
- **`ClaudeProvider`** - Claude/Anthropic provider adapter
- **`GroqProvider`** - Groq provider adapter
- **`GrokProvider`** - Grok provider adapter

### Utility Classes

- **`TokenCounter`** - Token counting and conversation analysis
- **`CostCalculator`** - Cost estimation and optimization
- **`StreamUtils`** - Stream processing utilities
- **`RateLimiter`** - Rate limiting functionality
- **`AnalyticsTracker`** - Usage analytics and monitoring

### Type Definitions

All types are fully documented with TypeScript. Import them as needed:

```typescript
import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  ModelCapabilities,
  UsageMetrics,
  CostMetrics,
  LLMCoreConfig,
} from "llm-core";
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

Integration tests require API keys:

```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export GROQ_API_KEY="your-key"

npm run test:integration
```

### Test with Docker

```bash
docker run -e OPENAI_API_KEY="your-key" llm-core:test
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/yourusername/llm-core.git
cd llm-core
npm install
npm run dev
```

### Running Tests

```bash
npm test                 # Unit tests
npm run test:integration # Integration tests (requires API keys)
npm run test:coverage    # Coverage report
```

## 📝 Migration Guide

### From OpenAI SDK

```typescript
// Before (OpenAI SDK)
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: "your-key" });

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }],
});

// After (LLMCore)
import { LLMCore } from "llm-core";
const llm = new LLMCore({
  providers: { openai: { provider: "openai", apiKey: "your-key" } },
  defaultProvider: "openai",
});

const response = await llm.chat({
  provider: "openai",
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }],
});
```

### From Anthropic SDK

```typescript
// Before (Anthropic SDK)
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: "your-key" });

const response = await anthropic.messages.create({
  model: "claude-3-sonnet-20240229",
  messages: [{ role: "user", content: "Hello" }],
  max_tokens: 100,
});

// After (LLMCore)
const response = await llm.chat({
  provider: "claude",
  model: "claude-3-sonnet-20240229",
  messages: [{ role: "user", content: "Hello" }],
  maxTokens: 100,
});
```

## 🔒 Security

- Store API keys securely (use environment variables)
- Validate all inputs before processing
- Use rate limiting to prevent abuse
- Monitor usage and costs regularly

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://llm-core-docs.com)
- 💬 [Discord Community](https://discord.gg/llm-core)
- 🐛 [Issue Tracker](https://github.com/yourusername/llm-core/issues)
- 📧 [Email Support](mailto:support@llm-core.com)

## 🙏 Acknowledgments

- OpenAI for the GPT models
- Anthropic for Claude
- Groq for fast inference
- xAI for Grok
- The open source community

---

**Made with ❤️ by the LLMCore team**
