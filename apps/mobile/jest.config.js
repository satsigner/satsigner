/** @type {import('jest').Config} */

process.env.TZ = 'UTC'
process.env.EXPO_PUBLIC_USE_RN_FETCH = '1'

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
  'immer',
  '@scure/.*',
  '@cashu/.*',
  '@noble/.*',
  'bip32',
  'nostr-tools',
  'immer'
].join('|')

const config = {
  moduleNameMapper: {
    // The adapter and the package it wraps share one facade contract, so both
    // resolve to the same mock: tests drive `@/api/payjoin` with no native
    // module, and keep importing the helpers from 'react-native-payjoin'.
    '^@/api/payjoinNative$': '<rootDir>/__mocks__/react-native-payjoin.ts',
    '^@secondts/bark-react-native$':
      '<rootDir>/__mocks__/secondts-bark-react-native.ts',
    '^bip-321$': '<rootDir>/__mocks__/bip-321.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^react-native-bdk-sdk$': '<rootDir>/__mocks__/react-native-bdk-sdk.ts',
    '^react-native-mmkv$': '<rootDir>/__mocks__/react-native-mmkv.ts',
    '^react-native-nitro-sqlite$':
      '<rootDir>/__mocks__/react-native-nitro-sqlite.ts',
    '^react-native-payjoin$': '<rootDir>/__mocks__/react-native-payjoin.ts',
    '^react-native-quick-crypto$':
      '<rootDir>/__mocks__/react-native-quick-crypto.ts',
    '^sonner-native$': '<rootDir>/__mocks__/sonner-native.ts'
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
