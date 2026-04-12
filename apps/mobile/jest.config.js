/** @type {import('jest').Config} */

process.env.TZ = 'UTC'

const TRANSFORM_PACKAGES = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  '@expo-google-fonts/.*',
  'react-navigation',
  '@react-navigation/.*',
  '@unimodules/.*',
  'unimodules',
  'sentry-expo',
  'native-base',
  'react-native-bdk-sdk',
  'react-native-svg',
  'uint8array-tools',
  '@scure/.*',
  '@cashu/.*',
  '@noble/.*',
  'bip32'
].join('|')

const config = {
  moduleNameMapper: {
    '^bip-321$': '<rootDir>/__mocks__/bip-321.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^react-native-bdk-sdk$': '<rootDir>/__mocks__/react-native-bdk-sdk.ts',
    '^react-native-quick-crypto$':
      '<rootDir>/__mocks__/react-native-quick-crypto.ts'
  },
  preset: 'jest-expo',
  transformIgnorePatterns: [
    // Regular node_modules: transform listed packages, but don't ignore .pnpm itself
    `/node_modules/(?!(\\.pnpm|${TRANSFORM_PACKAGES}))`,
    // pnpm virtual store: transform listed packages inside the nested node_modules
    `/node_modules/\\.pnpm/[^/]+/node_modules/(?!(${TRANSFORM_PACKAGES}))`
  ]
}

module.exports = config
