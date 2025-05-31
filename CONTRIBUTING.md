# Contributing to LLMCore

Thank you for your interest in contributing to LLMCore! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Provider Development](#provider-development)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [davidakpughe2@gmail.com](mailto:davidakpughe2@gmail.com).

## Getting Started

### Prerequisites

- Node.js 16.0.0 or higher
- npm 7.0.0 or higher
- Git

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/Akpughe/@davak/llm-core.git
   cd @davak/llm-core
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Set Up Environment**

   ```bash
   cp env.example .env
   # Add your API keys for testing
   ```

4. **Run Tests**

   ```bash
   npm test
   ```

5. **Start Development**
   ```bash
   npm run dev
   ```

## Contributing Guidelines

### 🔄 Workflow

1. **Create an Issue** - Discuss your idea before starting work
2. **Fork the Repository** - Create your own copy
3. **Create a Branch** - Use descriptive branch names
4. **Make Changes** - Follow coding standards
5. **Test Thoroughly** - Ensure all tests pass
6. **Submit PR** - Follow the PR template

### 🌿 Branch Naming

Use descriptive branch names following this pattern:

- `feature/add-anthropic-provider`
- `fix/streaming-timeout-issue`
- `docs/update-readme-examples`
- `refactor/simplify-error-handling`

### 📝 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/modifications
- `chore`: Build process or tool changes

**Examples:**

```bash
feat(providers): add Microsoft Azure OpenAI support
fix(groq): handle rate limiting correctly
docs(readme): add streaming examples
test(claude): improve error handling tests
```

## Pull Request Process

### 📋 PR Checklist

- [ ] Branch is up to date with main
- [ ] All tests pass (`npm run test:ci`)
- [ ] Code follows style guidelines (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Bundle size is within limits (`npm run size-check`)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Commit messages follow conventional format

### 📝 PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

## Issue Reporting

### 🐛 Bug Reports

Use the bug report template and include:

- **Environment**: OS, Node.js version, package version
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Code Sample**: Minimal reproduction case
- **Error Messages**: Full error output

### 💡 Feature Requests

Use the feature request template and include:

- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions considered
- **Additional Context**: Examples, mockups, etc.

## Provider Development

### 🔌 Adding New Providers

1. **Create Provider Class**

   ```typescript
   // src/providers/new-provider.ts
   export class NewProvider extends AbstractProvider {
     // Implementation
   }
   ```

2. **Add Type Definitions**

   ```typescript
   // src/types/providers.ts
   export interface NewProviderConfig extends BaseProviderConfig {
     // Provider-specific config
   }
   ```

3. **Implement Required Methods**

   - `chat(request: ChatRequest): Promise<ChatResponse>`
   - `chatStream(request: ChatRequest): Promise<StreamResponse>`
   - `getModels(): Promise<ModelsResponse>`
   - `estimateCost(request: ChatRequest): Promise<number>`

4. **Add Tests**

   ```typescript
   // src/__tests__/providers/new-provider.test.ts
   describe("NewProvider", () => {
     // Comprehensive test suite
   });
   ```

5. **Update Documentation**
   - Add provider to README.md
   - Update examples
   - Add configuration docs

### 🧪 Provider Testing

Each provider must have:

- Unit tests for all methods
- Integration tests with mock responses
- Error handling tests
- Streaming tests
- Cost calculation tests

## Testing

### 🔬 Test Structure

```
src/__tests__/
├── providers/           # Provider-specific tests
├── utils/              # Utility function tests
├── integration/        # Integration tests
└── fixtures/           # Test data and mocks
```

### 🏃 Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- providers/openai.test.ts

# Run in watch mode
npm run test:watch
```

### 📊 Coverage Requirements

- **Minimum**: 80% overall coverage
- **Providers**: 90% coverage for each provider
- **Critical paths**: 100% coverage for error handling

## Documentation

### 📚 Documentation Guidelines

1. **Code Comments**

   - Use JSDoc for all public APIs
   - Include examples for complex functions
   - Document parameter types and return values

2. **README Updates**

   - Keep examples current
   - Update supported models/providers
   - Maintain feature list

3. **Type Documentation**
   - Document all interface properties
   - Include usage examples
   - Explain complex types

### 📖 Writing Documentation

````typescript
/**
 * Creates a new chat completion request
 *
 * @example
 * ```typescript
 * const response = await provider.chat({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 *
 * @param request - The chat completion request
 * @returns Promise resolving to chat response
 * @throws {LLMCoreError} When request fails
 */
async chat(request: ChatRequest): Promise<ChatResponse>
````

## Release Process

### 🚀 Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

### 📦 Release Checklist

1. Update version in package.json
2. Update CHANGELOG.md
3. Create GitHub release
4. Automatic NPM publish via CI/CD

## Development Tools

### 🛠️ Available Scripts

```bash
npm run build          # Build for production
npm run build:dev      # Build for development
npm run dev            # Watch mode development
npm run test           # Run tests
npm run test:coverage  # Tests with coverage
npm run lint           # Lint code
npm run lint:fix       # Fix linting issues
npm run type-check     # TypeScript type checking
npm run size-check     # Check bundle size
npm run clean          # Clean build artifacts
```

### 🔧 Development Environment

- **Editor**: VS Code recommended with TypeScript extensions
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier (configure in your editor)
- **Testing**: Jest with TypeScript support

## Questions and Support

- **Issues**: [GitHub Issues](https://github.com/Akpughe/ts-llmcore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Akpughe/ts-llmcore/discussions)
- **Email**: [davidakpughe2@gmail.com](mailto:davidakpughe2@gmail.com)

## License

By contributing to LLMCore, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to LLMCore! 🎉
