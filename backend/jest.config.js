module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Slow test timeout — some DB operations may take a while
  testTimeout: 30000,
  // Run setup before all tests
  globalSetup: './tests/setup.js',
  // Global teardown after all tests
  globalTeardown: './tests/teardown.js',
  // Clear mocks between tests
  clearMocks: true,
  // Verbose output
  verbose: true,
  // Force exit after tests complete
  forceExit: true,
  // Detect open handles
  detectOpenHandles: true
};
