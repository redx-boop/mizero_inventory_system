/**
 * Global Jest teardown
 * Cleans up any test data created during test runs.
 */
module.exports = async () => {
  console.log('🧹 Test teardown: cleaning up...');
  // No destructive cleanup needed — tests use existing seed data
  // and any test-created records remain for inspection
  console.log('✅ Test teardown complete.');
};
