module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  // Test file patterns
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.test.ts",
    "<rootDir>/src/**/*.test.ts",
  ],

  // Coverage settings
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/*.test.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Module settings
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },

  // Setup and teardown
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,
};
