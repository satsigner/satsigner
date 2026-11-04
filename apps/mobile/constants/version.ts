import Constants from 'expo-constants'
import { Platform } from 'react-native'

export const APP_LICENSE = 'MIT'
export const APP_VERSION = Constants.expoConfig?.version ?? 'unknown'

// Android derives versionCode from the version (app.config.ts); iOS has no
// build number set, so the native default of 1 applies.
export const BUILD_NUMBER =
  Platform.OS === 'android'
    ? String(Constants.expoConfig?.android?.versionCode ?? '')
    : (Constants.expoConfig?.ios?.buildNumber ?? '1')
