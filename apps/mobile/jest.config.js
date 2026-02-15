/** @type {import('jest').Config} */

process.env.TZ = 'UTC'

const config = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|bdk-rn|react-native-svg)'
  ],
  moduleNameMapper: {
    '^bip-321$': '<rootDir>/__mocks__/bip-321.ts'
  }
}

module.exports = config
