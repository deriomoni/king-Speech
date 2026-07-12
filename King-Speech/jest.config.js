/**
 * Jest config scoped to the speech engine (spec §11).
 *
 * The engine's testable units are pure functions, so we use a lightweight
 * node environment + babel-jest (babel-preset-expo already transpiles TS).
 * Adapters/native code are never imported by tests, so no RN environment is
 * needed. Fixtures live in src/speech-engine/__fixtures__ as JSON.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/speech-engine'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` to an ESM import from
  // `expo/virtual/env`; allow jest to transform that (and other expo ESM).
  transformIgnorePatterns: ['node_modules/(?!(expo|expo-modules-core|@expo)/)'],
  clearMocks: true,
};
