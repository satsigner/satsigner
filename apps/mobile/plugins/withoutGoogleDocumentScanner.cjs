const {
  AndroidConfig,
  withAndroidManifest,
  withGradleProperties
} = require('expo/config-plugins')

// expo-camera ships ML Kit (a Google library) on Android for barcode and
// document scanning. Its barcodeScannerEnabled option turns the first off;
// this plugin turns off the document scanner, which has no plugin option,
// and drops the ML Kit manifest entry expo-camera still merges in.
const DOCUMENT_SCANNER_PROPERTY = 'expo.camera.document-scanner-enabled'
const MLKIT_DEPENDENCIES_META = 'com.google.mlkit.vision.DEPENDENCIES'
const TOOLS_NAMESPACE = 'http://schemas.android.com/tools'

function withoutDocumentScannerProperty(config) {
  return withGradleProperties(config, (gradleConfig) => {
    gradleConfig.modResults =
      AndroidConfig.BuildProperties.updateAndroidBuildProperty(
        gradleConfig.modResults,
        DOCUMENT_SCANNER_PROPERTY,
        'false'
      )
    return gradleConfig
  })
}

function withoutMlKitManifestEntry(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const { manifest } = manifestConfig.modResults
    manifest.$['xmlns:tools'] = TOOLS_NAMESPACE
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      manifestConfig.modResults
    )
    const others = (application['meta-data'] ?? []).filter(
      (entry) => entry.$['android:name'] !== MLKIT_DEPENDENCIES_META
    )
    application['meta-data'] = [
      ...others,
      { $: { 'android:name': MLKIT_DEPENDENCIES_META, 'tools:node': 'remove' } }
    ]
    return manifestConfig
  })
}

function withoutGoogleDocumentScanner(config) {
  return withoutMlKitManifestEntry(withoutDocumentScannerProperty(config))
}

module.exports = withoutGoogleDocumentScanner
