import { type ConfigContext, type ExpoConfig } from 'expo/config'

import {
  APP_VARIANT_PRODUCTION,
  getVariantAndroidAbis,
  getVariantAppName,
  getVariantPackageId,
  getVariantScheme
} from './constants/variant.cjs'
import { getAndroidVersionCode } from './constants/versionCode.cjs'

const APP_VERSION = '0.3.6'

// Satsigner never records audio or draws over other apps, and has no use for
// Google Play's install referrer. Blocking them also strips the copies that
// libraries (expo-camera, the Expo template) merge into the manifest.
const ANDROID_BLOCKED_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE'
]

const projectId = process.env.EXPO_PROJECT_ID

const IS_DEV = process.env.APP_VARIANT !== APP_VARIANT_PRODUCTION
const RAW_SUFFIX = process.env.APP_VARIANT_SUFFIX ?? ''

const getUniqueIdentifier = () => getVariantPackageId(IS_DEV, RAW_SUFFIX)

const getAppName = () => getVariantAppName(IS_DEV, RAW_SUFFIX)

const getScheme = () => getVariantScheme(IS_DEV, RAW_SUFFIX)

function getExpoConfig({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    android: {
      adaptiveIcon: {
        backgroundColor: '#ffffff',
        foregroundImage: './assets/adaptive-icon.png'
      },
      blockedPermissions: ANDROID_BLOCKED_PERMISSIONS,
      package: getUniqueIdentifier(),
      permissions: ['NFC'],
      versionCode: getAndroidVersionCode(APP_VERSION)
    },
    assetBundlePatterns: ['**/*'],
    description: 'Privacy-first Bitcoin signer with complete UTXO control',
    experiments: {
      reactCompiler: true,
      typedRoutes: true
    },
    extra: {
      brantaEnvironment: IS_DEV ? 'staging' : 'production',
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
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true
        },
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
            './assets/fonts/Geist-ExtraLight.ttf',
            './assets/fonts/Geist-Light.ttf',
            './assets/fonts/Geist-Regular.ttf',
            './assets/fonts/Geist-Medium.ttf',
            './assets/fonts/Geist-Bold.ttf',
            './assets/fonts/GeistMono-ExtraLight.ttf',
            './assets/fonts/GeistMono-Light.ttf',
            './assets/fonts/GeistMono-Regular.ttf',
            './assets/fonts/GeistMono-Medium.ttf',
            './assets/fonts/GeistMono-Bold.ttf'
          ]
        }
      ],
      'expo-secure-store',
      [
        'expo-camera',
        {
          // Android decodes QR codes with modules/ss-qr-scanner (zxing-cpp)
          // instead of Google ML Kit. iOS uses AVFoundation either way.
          barcodeScannerEnabled: false,
          cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera',
          microphonePermission: false,
          recordAudioAndroid: false
        }
      ],
      './plugins/withoutGoogleDocumentScanner.cjs',
      'expo-localization',
      [
        'expo-build-properties',
        {
          android: {
            buildArchs: getVariantAndroidAbis(IS_DEV),
            // Production: HTTPS-only. Dev keeps cleartext for local RPC/LND nodes.
            usesCleartextTraffic: IS_DEV
          },
          ios: {
            deploymentTarget: '16.4',
            // Release builds crash at launch when linked against the
            // precompiled Expo module XCFrameworks.
            usePrecompiledModules: false
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
    version: APP_VERSION,
    web: {
      favicon: './assets/favicon.png'
    }
  }
}

export default getExpoConfig
