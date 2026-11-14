const { AndroidConfig, withGradleProperties } = require('expo/config-plugins')

// R8 runs inside the Gradle daemon. The Expo template's 2 GB heap is too small
// to shrink a release build of this app, and R8 fails with OutOfMemoryError.
const GRADLE_JVM_ARGS_PROPERTY = 'org.gradle.jvmargs'
const GRADLE_JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m'

function withGradleHeap(config) {
  return withGradleProperties(config, (gradleConfig) => {
    gradleConfig.modResults =
      AndroidConfig.BuildProperties.updateAndroidBuildProperty(
        gradleConfig.modResults,
        GRADLE_JVM_ARGS_PROPERTY,
        GRADLE_JVM_ARGS
      )
    return gradleConfig
  })
}

module.exports = withGradleHeap
