import { type ConfigContext, type ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  android: {
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/adaptive-icon.png'
    },
    package: 'com.satsigner.satsigner',
    permissions: ['NFC']
  },
  androidStatusBar: {
    barStyle: 'light-content'
  },
  assetBundlePatterns: ['**/*'],
  description: 'Privacy-first Bitcoin signer with complete UTXO control',
  experiments: {
    typedRoutes: true
  },
  extra: {
    eas: {
      projectId: 'ab95f67d-1c03-4593-940d-fde0b7cdc34a'
    },
    router: {
      origin: false
    }
  },
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'com.satsigner.satsigner',
    infoPlist: {
      NFCReaderUsageDescription:
        'This app uses NFC to read and write data from NFC tags',
      'com.apple.developer.nfc.readersession.formats': ['NDEF', 'TAG']
    },
    supportsTablet: true
  },
  name: 'satsigner',
  orientation: 'portrait',
  plugins: [
    [
      'expo-build-properties',
      {
        android: { newArchEnabled: true },
        ios: { newArchEnabled: true }
      }
    ],
    [
      'expo-router',
      {
        ...(process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true'
          ? { root: './.storybook' }
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
    'expo-localization'
  ],
  scheme: 'satsigner',
  slug: 'satsigner',
  splash: {
    backgroundColor: '#121212',
    image: './assets/splash.png',
    resizeMode: 'contain'
  },
  userInterfaceStyle: 'dark',
  version: '0.2.1',
  web: {
    favicon: './assets/favicon.png'
  }
})
