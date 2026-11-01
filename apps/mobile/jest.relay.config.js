/** @type {import('jest').Config} */
const baseConfig = require('./jest.config')

const LIVE_TESTS_DIR = '<rootDir>/tests/relay/live/'
const runLiveTests = process.env.NOSTR_RELAY_LIVE === '1'

const config = {
  ...baseConfig,
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^react-native-nitro-sqlite$':
      '<rootDir>/tests/relay/support/nodeNitroSqlite.ts'
  },
  setupFiles: ['<rootDir>/tests/relay/support/preloadWinter.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/relay/support/setup.ts'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/relay/**/*.test.ts'],
  testPathIgnorePatterns: runLiveTests
    ? ['/node_modules/']
    : ['/node_modules/', LIVE_TESTS_DIR]
}

module.exports = config
