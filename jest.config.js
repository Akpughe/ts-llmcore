module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],

  // Test file patterns
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],

  // Coverage settings
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/index.ts",
    "!src/types/**", // Type definitions don't need coverage
  ],
  coverageThreshold: {
    global: {
      branches: 15, // Current: 14.54%, target: achievable improvement
      functions: 22, // Current: 21%, target: slight improvement
      lines: 25, // Current: 24.38%, target: slight improvement
      statements: 25, // Current: 23.72%, target: slight improvement
    },
    // Provider-specific thresholds (adjusted to current levels)
    "src/providers/openai.ts": {
      branches: 38, // Current: 39.81%, allow slight margin
      functions: 15, // Reasonable starting point
      lines: 20, // Reasonable starting point
      statements: 20, // Reasonable starting point
    },
    "src/providers/claude.ts": {
      branches: 15, // Current: 17.33%, allow margin
      functions: 20, // Current: 25%, allow margin
      lines: 20, // Current: 24.56%, allow margin
      statements: 20, // Current: 24.13%, allow margin
    },
    "src/providers/groq.ts": {
      branches: 35, // Current: 38.38%, allow margin
      functions: 15, // Reasonable starting point
      lines: 20, // Reasonable starting point
      statements: 20, // Reasonable starting point
    },
    "src/providers/grok.ts": {
      branches: 15, // Reasonable starting point
      functions: 15, // Reasonable starting point
      lines: 20, // Reasonable starting point
      statements: 20, // Reasonable starting point
    },
    // Core functionality (adjusted to current levels)
    "src/core/config.ts": {
      branches: 45, // Current: 50%, allow margin
      functions: 30, // Reasonable improvement target
      lines: 65, // Current: 70.27%, allow margin
      statements: 65, // Current: 70.27%, allow margin
    },
    "src/core/router.ts": {
      branches: 50, // Current: 54.28%, allow margin
      functions: 45, // High coverage expected for core logic
      lines: 60, // High coverage expected for core logic
      statements: 60, // High coverage expected for core logic
    },
    "src/core/llmcore.ts": {
      branches: 10, // Starting point for untested file
      functions: 10, // Starting point for untested file
      lines: 15, // Starting point for untested file
      statements: 15, // Starting point for untested file
    },
  },

  // Module settings
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
        },
      },
    ],
  },

  // Setup and teardown
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Test timeout
  testTimeout: 15000, // Increased for integration tests

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Performance optimizations
  maxWorkers: "50%", // Use half of available CPU cores
  cache: true,
  cacheDirectory: "<rootDir>/.jest-cache",

  // Test organization
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],

  // Error handling
  errorOnDeprecated: true,

  // Watch mode settings
  watchPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],
};
