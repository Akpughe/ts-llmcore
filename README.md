# LLMCore

A unified TypeScript/JavaScript package that provides a single interface to interact with multiple LLM providers (OpenAI, Claude, Grok, Groq) without vendor lock-in or complex provider-specific code.

## 🚀 Why LLMCore?

Instead of writing different code for each LLM provider:

```javascript
// Current pain point - different APIs for each provider
const openai = new OpenAI({apiKey: "..."});
const anthropic = new Anthropic({apiKey: "..."});
const groq = new Groq({apiKey: "..."});

// Different method calls, different response formats
await openai.chat.completions.create({...});
await anthropic.messages.create({...});
await groq.chat.completions.create({...});
```

You get one unified interface:

```javascript
// Our solution - one interface for all
const llm = new LLMCore({...});
await llm.chat({provider: "openai", model: "gpt-4", messages: [...]});
await llm.chat({provider: "claude", model: "sonnet", messages: [...]});
await llm.chat({provider: "groq", model: "llama", messages: [...]});
```

## 📦 Installation

```bash
npm install llm-core
```

You'll also need to install the specific provider SDKs you want to use:

```bash
# For OpenAI
npm install openai

# For Claude (Anthropic)
npm install @anthropic-ai/sdk

# For Groq
npm install groq-sdk
```

## 🏗️ Architecture

LLMCore uses a three-layer architecture:

1. **Provider Layer** - Individual adapters for each LLM service
2. **Abstraction Layer** - Common interface and request routing
3. **User Interface Layer** - Simple, consistent API for developers

## ✨ Features

### Core Functionality

- ✅ Unified chat interface across all providers
- ✅ Easy provider/model switching
- ✅ Consistent response format
- ✅ Type-safe TypeScript support

### Developer Experience

- ✅ Simple configuration setup
- ✅ Automatic model discovery
- ✅ Built-in error handling
- ✅ Comprehensive documentation

### Advanced Features

- 🔄 Streaming support for real-time responses
- 📊 Token usage and cost tracking
- 🔄 Automatic retries and rate limiting
- 📈 Usage analytics and logging

## 🤖 Supported Providers & Models

### OpenAI

- GPT-4 (gpt-4-turbo-preview, gpt-4-0125-preview)
- GPT-3.5 (gpt-3.5-turbo, gpt-3.5-turbo-16k)
- GPT-4o (gpt-4o, gpt-4o-mini)

### Claude (Anthropic)

- Claude Sonnet 4 (claude-sonnet-4-20250514)
- Claude Opus 4 (claude-opus-4-20250514)

### Grok (xAI)

- Grok models (grok-beta, grok-vision-beta)

### Groq

- Llama (llama-3.1-70b-versatile, llama-3.1-8b-instant)
- Mixtral (mixtral-8x7b-32768)
- Gemma (gemma-7b-it, gemma2-9b-it)

## 🔧 Usage

### Basic Setup

```typescript
import { LLMCore } from "llm-core";

const llm = new LLMCore({
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: "gpt-4",
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      defaultModel: "sonnet",
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      defaultModel: "llama",
    },
  },
});
```

### Simple Chat

```typescript
const response = await llm.chat({
  provider: "openai",
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

console.log(response.content);
```

### Provider Switching

```typescript
// Same code, different provider
const openaiResponse = await llm.chat({
  provider: "openai",
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
});

const claudeResponse = await llm.chat({
  provider: "claude",
  model: "sonnet",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Streaming Support

```typescript
const stream = await llm.chat({
  provider: "groq",
  model: "llama",
  messages: [{ role: "user", content: "Tell me a story" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

## 📋 Configuration

### Environment Variables

Create a `.env` file:

```env
OPENAI_API_KEY=your_openai_api_key
CLAUDE_API_KEY=your_claude_api_key
GROQ_API_KEY=your_groq_api_key
GROK_API_KEY=your_grok_api_key
```

### TypeScript Configuration

```typescript
interface LLMCoreConfig {
  providers: {
    [provider: string]: {
      apiKey: string;
      defaultModel?: string;
      baseURL?: string;
      timeout?: number;
      retries?: number;
    };
  };
  defaultProvider?: string;
  logging?: boolean;
  analytics?: boolean;
}
```

## 🧪 Development

### Setup

```bash
git clone https://github.com/yourusername/llm-core.git
cd llm-core
npm install
```

### Scripts

```bash
# Development
npm run dev          # Watch mode with auto-rebuild
npm run build        # Build for production
npm run type-check   # TypeScript type checking

# Testing
npm test             # Run tests
npm run test:watch   # Watch mode testing
npm run test:coverage # Coverage report

# Linting
npm run lint         # Check code style
npm run lint:fix     # Fix linting issues
```

### Project Structure

```
src/
├── types/           # TypeScript type definitions
├── providers/       # Provider-specific adapters
├── utils/           # Utility functions
├── __tests__/       # Test files
└── index.ts         # Main entry point
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📚 [Documentation](https://github.com/yourusername/llm-core/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/llm-core/issues)
- 💬 [Discussions](https://github.com/yourusername/llm-core/discussions)

## 🏷️ Keywords

`llm` `ai` `openai` `claude` `anthropic` `groq` `grok` `chat` `completion` `typescript` `javascript` `nodejs`
