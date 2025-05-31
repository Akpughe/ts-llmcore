# LLMCore 🚀

**A unified TypeScript/JavaScript package providing a single interface for multiple LLM providers**

[![npm version](https://badge.fury.io/js/@davak/llm-core.svg)](https://badge.fury.io/js/@davak/llm-core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/Akpughe/ts-llmcore/workflows/CI/badge.svg)](https://github.com/Akpughe/ts-llmcore/actions)
[![Coverage Status](https://codecov.io/gh/Akpughe/ts-llmcore/branch/main/graph/badge.svg)](https://codecov.io/gh/Akpughe/ts-llmcore)

Eliminate vendor lock-in and simplify your AI integrations with support for **OpenAI**, **Claude**, **Groq**, **Grok**, and more providers through a single, consistent API.

## ✨ Key Features

- 🔄 **No Vendor Lock-in**: Switch between providers with one line of code
- 💰 **Cost Optimization**: Built-in cost tracking and optimization across all providers
- 🏎️ **Streaming Support**: Real-time responses from all providers with abort control
- 🛠️ **Tool Calling**: Unified function calling interface across providers
- 📊 **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🔍 **Token Management**: Automatic token counting and conversation management
- ⚡ **Performance**: Optimized HTTP clients with connection pooling
- 🛡️ **Reliability**: Comprehensive error handling and automatic retries

## 🚀 Quick Start

### Installation

```bash
npm install @davak/llm-core
```

### Basic Usage

```typescript
import { LLMCore } from "@davak/llm-core";

// Initialize with your preferred provider
const llm = new LLMCore({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple chat completion
const response = await llm.chat({
  model: "gpt-4o",
  messages: [
    { role: "user", content: "Explain quantum computing in simple terms" },
  ],
});

console.log(response.message.content);
```

### Provider Switching

Switch providers instantly without changing your code:

```typescript
// Start with OpenAI
const openaiLLM = new LLMCore({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
});

// Switch to Claude for better reasoning
const claudeLLM = new LLMCore({
  provider: "claude",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Switch to Groq for ultra-fast inference
const groqLLM = new LLMCore({
  provider: "groq",
  apiKey: process.env.GROQ_API_KEY,
});

// All use the same interface!
const request = {
  model: "claude-3-sonnet-20240229", // or 'gpt-4o', 'llama-3.1-70b-versatile'
  messages: [{ role: "user", content: "Hello!" }],
};
```

## 📖 Comprehensive Examples

### Streaming Responses

```typescript
const streamResponse = await llm.chatStream({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Write a short story about AI" }],
});

for await (const chunk of streamResponse.stream) {
  if (chunk.delta.content) {
    process.stdout.write(chunk.delta.content);
  }
}
```

### Function Calling / Tool Usage

```typescript
const response = await llm.chat({
  model: "gpt-4o",
  messages: [{ role: "user", content: "What's the weather like in Tokyo?" }],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
      },
    },
  ],
});

if (response.message.toolCalls) {
  for (const toolCall of response.message.toolCalls) {
    console.log(`Function called: ${toolCall.function.name}`);
    console.log(`Arguments: ${toolCall.function.arguments}`);
  }
}
```

### Cost Tracking and Token Management

```typescript
import { TokenCounter, CostCalculator } from "@davak/llm-core";

// Count tokens before sending
const tokenCount = TokenCounter.countConversationTokens(messages, {
  provider: "openai",
  model: "gpt-4o",
});

console.log(`Estimated tokens: ${tokenCount.tokens}`);
console.log(
  `Estimated cost: $${TokenCounter.estimateCost(tokenCount.tokens, "gpt-4o")}`
);

// Get cost information from response
const response = await llm.chat({ model: "gpt-4o", messages });
if (response.cost) {
  console.log(`Actual cost: $${response.cost.totalCost}`);
}
```

### Advanced Configuration

```typescript
const llm = new LLMCore({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,

  // Global configuration
  timeout: 30000,
  retries: 3,

  // Cost tracking
  costTracking: {
    enabled: true,
    currency: "USD",
  },

  // Rate limiting
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 60,
  },

  // Analytics
  analytics: {
    enabled: true,
    trackTokenUsage: true,
    trackCosts: true,
  },
});
```

## 🔌 Supported Providers

| Provider   | Models                         | Streaming | Tools | Vision |
| ---------- | ------------------------------ | --------- | ----- | ------ |
| **OpenAI** | GPT-4o, GPT-4, GPT-3.5-turbo   | ✅        | ✅    | ✅     |
| **Claude** | Claude 3.5 Sonnet, Opus, Haiku | ✅        | ✅    | ✅     |
| **Groq**   | Llama 3.1, Mixtral, Gemma      | ✅        | ✅    | ❌     |
| **Grok**   | grok-beta, grok-vision-beta    | ✅        | ✅    | ✅     |

### Model Support

#### OpenAI Models

- `gpt-4o`, `gpt-4o-mini`, `gpt-4o-2024-05-13`
- `gpt-4`, `gpt-4-32k`, `gpt-4-turbo`
- `gpt-3.5-turbo`, `gpt-3.5-turbo-16k`

#### Claude Models

- `claude-3-5-sonnet-20241022` (Latest)
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

#### Groq Models

- `llama-3.1-70b-versatile`, `llama-3.1-8b-instant`
- `mixtral-8x7b-32768`
- `gemma-7b-it`, `gemma2-9b-it`

#### Grok Models

- `grok-beta`, `grok-vision-beta`

## 🛠️ Advanced Features

### Provider Health Monitoring

```typescript
const health = await llm.healthCheck();
console.log(`Provider status: ${health.status}`);
console.log(`Latency: ${health.latency}ms`);
```

### Model Capabilities Detection

```typescript
import { ModelCapabilityDetector } from "@davak/llm-core";

const capabilities = ModelCapabilityDetector.getCapabilities("gpt-4o");
console.log(`Supports streaming: ${capabilities.streaming}`);
console.log(`Supports tools: ${capabilities.tools}`);
console.log(`Max context: ${capabilities.contextLength} tokens`);
```

### Response Standardization

```typescript
import { ResponseStandardizer } from "@davak/llm-core";

const standardized = ResponseStandardizer.standardize(response, {
  includeRaw: true,
  calculateCost: true,
});

console.log("Enhanced metadata:", standardized.metadata);
```

### Conversation Management

```typescript
// Automatically manage conversation length
const { truncatedMessages } = TokenCounter.truncateToLimit(
  messages,
  "gpt-4o",
  4000 // Reserve tokens for response
);

const response = await llm.chat({
  model: "gpt-4o",
  messages: truncatedMessages,
});
```

## 📊 Error Handling

```typescript
import { LLMCoreError } from "@davak/llm-core";

try {
  const response = await llm.chat({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello!" }],
  });
} catch (error) {
  if (error instanceof LLMCoreError) {
    switch (error.type) {
      case "authentication":
        console.error("Invalid API key");
        break;
      case "rate_limit":
        console.error("Rate limit exceeded, retrying...");
        // Automatic retry logic
        break;
      case "server_error":
        console.error("Provider server error");
        break;
      default:
        console.error("Unknown error:", error.message);
    }
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Provider API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_claude_key
GROQ_API_KEY=your_groq_key
GROK_API_KEY=your_grok_key

# Optional Configuration
LLM_CORE_TIMEOUT=30000
LLM_CORE_RETRIES=3
LLM_CORE_LOG_LEVEL=info
```

### Provider-Specific Configuration

```typescript
// OpenAI with organization
const openaiLLM = new LLMCore({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-123",
  project: "proj-abc",
});

// Claude with custom base URL
const claudeLLM = new LLMCore({
  provider: "claude",
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.anthropic.com",
});

// Groq with custom timeout
const groqLLM = new LLMCore({
  provider: "groq",
  apiKey: process.env.GROQ_API_KEY,
  timeout: 10000, // Ultra-fast responses
});
```

## 📦 Package Information

- **Bundle Size**: 26KB (minified + gzipped)
- **Tree Shakeable**: ✅ Import only what you need
- **TypeScript**: Full type definitions included
- **Node.js**: >= 16.0.0 required
- **Formats**: CommonJS and ESM

### Installation Options

```bash
# npm
npm install @davak/llm-core

# yarn
yarn add @davak/llm-core

# pnpm
pnpm add @davak/llm-core

# bun
bun add @davak/llm-core
```

### Peer Dependencies (Optional)

Install provider SDKs for enhanced features:

```bash
npm install openai anthropic @groq/sdk
```

## 🔒 Security

- API keys are handled securely and never logged
- All requests use HTTPS with proper authentication
- No sensitive data is stored or cached by default
- Built-in rate limiting prevents abuse

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run tests for CI (with coverage)
npm run test:ci

# Upload coverage to Codecov (requires CODECOV_TOKEN)
npm run coverage:upload

# Run tests and upload coverage in one command
npm run coverage:ci

# Run specific test
npm test -- providers/openai.test.ts
```

### Coverage Reporting

The project uses [Codecov](https://codecov.io) for coverage tracking with enhanced reliability:

- **Rate Limit Protection**: Uses repository token to avoid anonymous upload limits
- **Retry Logic**: Automatically retries failed uploads with exponential backoff
- **CI Integration**: Seamless GitHub Actions integration
- **Local Testing**: Upload coverage from local development

For detailed coverage setup instructions, see [docs/CODECOV_SETUP.md](docs/CODECOV_SETUP.md).

## 📈 Performance

- **Latency**: Optimized HTTP clients with connection pooling
- **Memory**: Efficient streaming with backpressure handling
- **Throughput**: Built-in rate limiting and request queuing
- **Bundle Size**: Minimal footprint with tree shaking

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/llmcore/@davak/llm-core.git
cd @davak/llm-core
npm install
npm run dev
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and migration guides.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [📚 Documentation](https://github.com/Akpughe/ts-llmcore#readme)
- [🐛 Issues](https://github.com/Akpughe/ts-llmcore/issues)
- [💬 Discussions](https://github.com/Akpughe/ts-llmcore/discussions)
- [📦 npm Package](https://www.npmjs.com/package/@davak/llm-core)

## 🌟 Show Your Support

If this project helps you, please consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🤝 Contributing code

---

<div align="center">

**Built with ❤️ for the AI community**

[GitHub](https://github.com/Akpughe/ts-llmcore) • [Documentation](https://github.com/Akpughe/ts-llmcore#readme) • [Email](mailto:davidakpughe2@gmail.com)

</div>
