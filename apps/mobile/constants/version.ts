import { getBuildNumber, getVersion } from 'react-native-device-info'

export const APP_VERSION = getVersion()
export const BUILD_NUMBER = getBuildNumber()
