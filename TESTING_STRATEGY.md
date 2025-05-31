# LLMCore Testing Strategy & Best Practices

## Overview

This document outlines the comprehensive testing strategy for the LLMCore package, including patterns, best practices, and continuous improvement recommendations.

## Current Test Architecture

### Test Structure

```
src/__tests__/
├── core/                 # Core functionality tests
│   ├── config.test.ts
│   ├── llmcore.test.ts
│   └── router.test.ts
├── providers/            # Provider-specific tests
│   ├── groq.test.ts
│   ├── grok.test.ts
│   └── openai.test.ts
├── integration/          # Integration tests
│   └── provider-integration.test.ts
├── utils/               # Utility tests
│   ├── test-helpers.ts  # Shared test utilities
│   └── token-counter.test.ts
└── .gitkeep
```

## Testing Principles

### 1. **Comprehensive Coverage**

- **Unit Tests**: 90%+ coverage for core functionality
- **Integration Tests**: End-to-end provider workflows
- **Error Handling**: All error paths tested
- **Edge Cases**: Boundary conditions and malformed data

### 2. **Consistent Patterns**

- Standardized mocking strategies
- Uniform error assertion patterns
- Consistent test data factories
- Shared utility functions

### 3. **Reliability**

- Deterministic test execution
- Proper async handling
- Clean test isolation
- Predictable mock behavior

## Current Issues Fixed

### ✅ **Provider Test Standardization**

- **Problem**: Inconsistent error handling expectations
- **Solution**: Updated tests to expect `LLMCoreError` objects instead of thrown strings
- **Impact**: All provider tests now pass consistently

### ✅ **Error Handling Improvements**

- **Problem**: Base class `handleError` was wrapping already-formatted errors
- **Solution**: Added LLMCoreError detection to preserve original error structure
- **Impact**: Proper error propagation throughout the system

### ✅ **Coverage Configuration**

- **Problem**: Coverage thresholds set to 0%
- **Solution**: Implemented realistic coverage targets:
  - Global: 80-85%
  - Providers: 85-90%
  - Core: 90-95%

## Test Utilities & Patterns

### Mock Factories

```typescript
// Standardized axios mocking
const mockAxiosInstance = createMockAxiosInstance();

// Consistent test data
const testRequest = createTestChatRequest({
  provider: "groq",
  model: "mixtral-8x7b-32768",
});
```

### Error Testing Pattern

```typescript
// Before (inconsistent)
await expect(provider.chat(request)).rejects.toThrow("Invalid API key");

// After (standardized)
await expect(provider.chat(request)).rejects.toMatchObject({
  type: "authentication",
  code: "INVALID_API_KEY",
  provider: "groq",
});
```

## Performance Optimizations

### Jest Configuration Improvements

- **Parallel Execution**: 50% CPU core utilization
- **Caching**: Enabled with dedicated cache directory
- **Timeout Management**: 15s for integration tests
- **Watch Mode**: Optimized file watching patterns

### Test Execution Strategy

- **Unit Tests**: Fast, isolated, comprehensive
- **Integration Tests**: Slower, end-to-end validation
- **CI/CD**: Parallel test execution with proper reporting

## Quality Metrics

### Coverage Targets

| Component | Lines | Functions | Branches | Statements |
| --------- | ----- | --------- | -------- | ---------- |
| Global    | 85%   | 85%       | 80%      | 85%        |
| Providers | 90%   | 90%       | 85%      | 90%        |
| Core      | 95%   | 95%       | 90%      | 95%        |

### Test Quality Indicators

- **Flaky Test Rate**: < 1%
- **Test Execution Time**: < 30s for full suite
- **Coverage Drift**: < 5% decrease between releases
- **Error Detection Rate**: > 95% of introduced bugs caught

## Continuous Improvement Plan

### Phase 1: Foundation (Completed ✅)

- [x] Standardize provider test patterns
- [x] Fix error handling inconsistencies
- [x] Implement proper coverage thresholds
- [x] Create shared test utilities

### Phase 2: Enhancement (Next Steps)

- [ ] Add mutation testing for quality validation
- [ ] Implement visual regression testing for outputs
- [ ] Create performance benchmarking tests
- [ ] Add contract testing between providers

### Phase 3: Advanced (Future)

- [ ] Automated test generation for new providers
- [ ] AI-powered test case discovery
- [ ] Real-time test quality monitoring
- [ ] Predictive test failure analysis

## Best Practices

### 1. **Test Organization**

```typescript
describe("ProviderName", () => {
  describe("core functionality", () => {
    // Happy path tests
  });

  describe("error handling", () => {
    // Error scenarios
  });

  describe("edge cases", () => {
    // Boundary conditions
  });
});
```

### 2. **Mock Management**

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // Reset to known state
});

afterEach(() => {
  jest.restoreMocks();
  // Clean up any side effects
});
```

### 3. **Async Testing**

```typescript
// Use proper async/await patterns
await expect(asyncFunction()).resolves.toMatchObject(expected);
await expect(asyncFunction()).rejects.toMatchObject(expectedError);
```

### 4. **Data Isolation**

```typescript
// Use factories for test data
const request = createTestChatRequest({
  // Only override what's specific to this test
  model: "specific-model",
});
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
test:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      node-version: [16, 18, 20]
  steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: "npm"
    - run: npm ci
    - run: npm run test:ci
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

### Quality Gates

- **Coverage**: Must maintain minimum thresholds
- **Test Execution**: All tests must pass
- **Performance**: Test suite must complete within time limits
- **Linting**: No linting errors allowed

## Monitoring & Alerting

### Test Health Metrics

- **Daily**: Test execution time trends
- **Weekly**: Coverage trend analysis
- **Monthly**: Test quality assessment
- **Release**: Comprehensive test report

### Alerts

- **Flaky Tests**: Immediate notification for unstable tests
- **Coverage Drop**: Alert on significant coverage decrease
- **Performance**: Notification for slow test execution
- **Failures**: Real-time alerts for test failures

## Tools & Dependencies

### Core Testing Stack

- **Jest**: Test runner and assertion library
- **TypeScript**: Type safety in tests
- **ts-jest**: TypeScript transformation
- **@types/jest**: TypeScript definitions

### Quality Tools

- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality gates
- **lint-staged**: Pre-commit linting

### Reporting

- **Jest HTML Reporter**: Visual test reports
- **Coverage Reports**: LCOV, HTML, JSON formats
- **Test Results**: JUnit XML for CI integration

## Troubleshooting Guide

### Common Issues

#### 1. **Flaky Tests**

```bash
# Run single test multiple times
npm test -- --testNamePattern="specific test" --verbose

# Check for timing issues
npm test -- --detectOpenHandles --forceExit
```

#### 2. **Coverage Issues**

```bash
# Generate detailed coverage report
npm run test:coverage

# Check uncovered lines
open coverage/lcov-report/index.html
```

#### 3. **Mock Problems**

```bash
# Clear Jest cache
npm test -- --clearCache

# Run with verbose mocking
npm test -- --verbose --no-cache
```

## Contributing Guidelines

### Adding New Tests

1. Follow established patterns in existing tests
2. Use shared utilities from `test-helpers.ts`
3. Ensure proper error handling coverage
4. Add integration tests for new features

### Test Review Checklist

- [ ] Tests follow naming conventions
- [ ] Proper async/await usage
- [ ] Mock isolation and cleanup
- [ ] Error scenarios covered
- [ ] Performance considerations
- [ ] Documentation updated

## Conclusion

This testing strategy ensures high-quality, maintainable, and reliable tests for the LLMCore package. By following these patterns and continuously improving our testing practices, we maintain confidence in our codebase and enable rapid, safe development.

For questions or suggestions, please refer to the team's testing guidelines or create an issue in the repository.
