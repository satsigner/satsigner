import { type ConfigContext, type ExpoConfig } from 'expo/config'

const projectId = process.env.EXPO_PROJECT_ID

const IS_DEV = process.env.APP_VARIANT !== 'production'

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return 'com.satsigner.satsigner.dev'
  }

  return 'com.satsigner.satsigner'
}

const getAppName = () => {
  if (IS_DEV) {
    return 'satsigner (Dev)'
  }

  return 'satsigner'
}

const getScheme = () => {
  if (IS_DEV) {
    return 'satsignerdev'
  }

  return 'satsigner'
}

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
          useHermesV1: false
        },
        ios: {
          useHermesV1: false
        }
      }
    ],
    'expo-image',
    'expo-sharing',
    'expo-web-browser',
    '@secondts/bark-react-native'
  ],
  scheme: getScheme(),
  slug: 'satsigner',
  splash: {
    backgroundColor: '#000000',
    image: './assets/splash.png',
    resizeMode: 'contain'
  },
  userInterfaceStyle: 'dark',
  version: '0.3.5',
  web: {
    favicon: './assets/favicon.png'
  }
})
