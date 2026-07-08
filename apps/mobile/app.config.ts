import { type ConfigContext, type ExpoConfig } from 'expo/config'

const projectId = process.env.EXPO_PROJECT_ID

const IS_DEV = process.env.APP_VARIANT !== 'production'

// Optional per-branch/per-PR suffix, set by scripts/variant.mjs. When present,
// it is appended to the package id, app name, and URL scheme so multiple builds
// can coexist on the same device, each with its own isolated storage.
const RAW_SUFFIX = process.env.APP_VARIANT_SUFFIX ?? ''

// Android package segments must be lowercase, alphanumeric or underscore, and
// cannot start with a digit.
const getPackageSegment = () => {
  const segment = RAW_SUFFIX.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)

  if (!segment) {
    return ''
  }

  return /^[a-z]/.test(segment) ? segment : `b_${segment}`
}

// URI schemes disallow underscores, so strip everything except [a-z0-9].
const getSchemeSegment = () =>
  RAW_SUFFIX.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24)

const PACKAGE_SEGMENT = getPackageSegment()
const SCHEME_SEGMENT = getSchemeSegment()

const getUniqueIdentifier = () => {
  const base = IS_DEV ? 'com.satsigner.satsigner.dev' : 'com.satsigner.satsigner'

  return PACKAGE_SEGMENT ? `${base}.${PACKAGE_SEGMENT}` : base
}

const getAppName = () => {
  if (IS_DEV) {
    return PACKAGE_SEGMENT ? `${PACKAGE_SEGMENT} (Dev)` : 'satsigner (Dev)'
  }

  return PACKAGE_SEGMENT ? `${PACKAGE_SEGMENT} (Prod)` : 'satsigner'
}

const getScheme = () => {
  const base = IS_DEV ? 'satsignerdev' : 'satsigner'

  return SCHEME_SEGMENT ? `${base}${SCHEME_SEGMENT}` : base
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
