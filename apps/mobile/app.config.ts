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
    reactCompiler: true,
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
      UIDesignRequiresCompatibility: true,
      'com.apple.developer.nfc.readersession.formats': ['NDEF', 'TAG']
    },
    supportsTablet: true
  },
  name: 'satsigner',
  orientation: 'portrait',
  plugins: [
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
          useHermesV1: false
        },
        ios: {
          buildReactNativeFromSource: true,
          useHermesV1: true
        }
      }
    ],
    'expo-image',
    'expo-sharing',
    'expo-web-browser',
    '@secondts/bark-react-native'
  ],
  scheme: 'satsigner',
  slug: 'satsigner',
  splash: {
    backgroundColor: '#000000',
    image: './assets/splash.png',
    resizeMode: 'contain'
  },
  userInterfaceStyle: 'dark',
  version: '0.3.0',
  web: {
    favicon: './assets/favicon.png'
  }
})
