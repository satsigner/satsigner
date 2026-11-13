// The only permissions a Satsigner release APK may request. The release tool
// fails a build or publish that asks for anything else, so a new library
// cannot slip a permission onto the store page unnoticed.
const ANDROID_ALLOWED_PERMISSIONS = [
  // QR scanning
  'android.permission.CAMERA',
  // Electrum, Esplora, Nostr and Lightning connections
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  // Android 16 asks for it to reach the user's own node on the LAN
  'android.permission.ACCESS_LOCAL_NETWORK',
  // Air-gapped signing over NFC
  'android.permission.NFC',
  // Haptics
  'android.permission.VIBRATE',
  // Biometric unlock; USE_FINGERPRINT serves Android 8 and older
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT'
]

// androidx.core declares <package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION,
// a signature permission private to the app itself.
const ANDROID_APP_PRIVATE_PERMISSION_SUFFIX =
  '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'

// Blocking a permission also strips the copies libraries merge in:
// - RECORD_AUDIO: expo-camera; Satsigner never records audio
// - SYSTEM_ALERT_WINDOW, install referrer: the Expo template
// - READ_MEDIA_IMAGES, DETECT_SCREEN_CAPTURE: expo-screen-capture's
//   screenshot listener; FLAG_SECURE needs neither
// - READ/WRITE_EXTERNAL_STORAGE: expo-file-system; Satsigner only writes to
//   its own document and cache directories
// - ACCESS_WIFI_STATE: netinfo checks for it before reading Wi-Fi details
// - CHANGE_NETWORK_STATE: react-native-tcp-socket, only for its unused
//   `interface` option
// - WAKE_LOCK: media3 via expo-video, which never sets a wake mode
const ANDROID_BLOCKED_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.DETECT_SCREEN_CAPTURE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_NETWORK_STATE',
  'android.permission.WAKE_LOCK'
]

function isAllowedAndroidPermission(name) {
  return (
    ANDROID_ALLOWED_PERMISSIONS.includes(name) ||
    name.endsWith(ANDROID_APP_PRIVATE_PERMISSION_SUFFIX)
  )
}

module.exports = {
  ANDROID_ALLOWED_PERMISSIONS,
  ANDROID_BLOCKED_PERMISSIONS,
  isAllowedAndroidPermission
}
