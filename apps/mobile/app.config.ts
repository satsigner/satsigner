import { type ConfigContext, type ExpoConfig } from 'expo/config'

import {
  APP_VARIANT_PRODUCTION,
  getVariantAppName,
  getVariantPackageId,
  getVariantScheme
} from './constants/variant.cjs'

const projectId = process.env.EXPO_PROJECT_ID

const IS_DEV = process.env.APP_VARIANT !== APP_VARIANT_PRODUCTION
const RAW_SUFFIX = process.env.APP_VARIANT_SUFFIX ?? ''

const getUniqueIdentifier = () => getVariantPackageId(IS_DEV, RAW_SUFFIX)

const getAppName = () => getVariantAppName(IS_DEV, RAW_SUFFIX)

const getScheme = () => getVariantScheme(IS_DEV, RAW_SUFFIX)

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  android: {
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/adaptive-icon.png'
    },
    package: getUniqueIdentifier(),
    permissions: ['NFC']
  },
  assetBundlePatterns: ['**/*'],
  description: 'Privacy-first Bitcoin signer with complete UTXO control',
  experiments: {
    reactCompiler: true,
    typedRoutes: true
  },
  extra: {
    eas: { projectId },
    router: {
      origin: false
    }
  },
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: getUniqueIdentifier(),
    infoPlist: {
      NFCReaderUsageDescription:
        'This app uses NFC to read and write data from NFC tags',
      UIDesignRequiresCompatibility: true,
      'com.apple.developer.nfc.readersession.formats': ['NDEF', 'TAG']
    },
    supportsTablet: true
  },
  name: getAppName(),
  orientation: 'portrait',
  plugins: [
    'expo-dev-client',
    [
      'expo-router',
      {
        ...(process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true'
          ? { root: './.rnstorybook' }
          : undefined)
      }
    ],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/SF-Pro-Text-Ultralight.otf',
          './assets/fonts/SF-Pro-Text-Light.otf',
          './assets/fonts/SF-Pro-Text-Regular.otf',
          './assets/fonts/SF-Pro-Text-Medium.otf',
          './assets/fonts/SF-Pro-Text-Bold.otf',
          './assets/fonts/SF-NS-Mono.ttf',
          './assets/fonts/TerminessNerdFontMono-Regular.ttf',
          './assets/fonts/TerminessNerdFontMono-Bold.ttf',
          './assets/fonts/TerminessNerdFontMono-BoldItalic.ttf',
          './assets/fonts/TerminessNerdFontMono-Italic.ttf'
        ]
      }
    ],
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera'
      }
    ],
    'expo-localization',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true
        },
        ios: {
          deploymentTarget: '16.4'
        }
      }
    ],
    'expo-image',
    [
      'expo-status-bar',
      {
        style: 'light'
      }
    ],
    'expo-sharing',
    'expo-web-browser',
    '@secondts/bark-react-native',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/splash.png',
        resizeMode: 'contain'
      }
    ]
  ],
  scheme: getScheme(),
  slug: 'satsigner',
  userInterfaceStyle: 'dark',
  version: '0.3.6',
  web: {
    favicon: './assets/favicon.png'
  }
})
