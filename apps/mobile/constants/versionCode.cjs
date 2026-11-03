// Android decides whether a build is an update by comparing versionCode, not
// the version name. Deriving it from the version keeps it rising with every
// release (0.3.7 -> 3007, 1.0.0 -> 1000000) without a counter to bump by hand.
// It must never go down once published.
const VERSION_CODE_MAJOR_FACTOR = 1_000_000
const VERSION_CODE_MINOR_FACTOR = 1000
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

function getAndroidVersionCode(version) {
  const match = SEMVER_PATTERN.exec(version)
  if (!match) {
    throw new Error(`Version "${version}" is not major.minor.patch`)
  }
  const [major, minor, patch] = match.slice(1).map(Number)
  if (
    minor >= VERSION_CODE_MINOR_FACTOR ||
    patch >= VERSION_CODE_MINOR_FACTOR
  ) {
    throw new Error(`Version "${version}" has a part of 1000 or more`)
  }
  return (
    major * VERSION_CODE_MAJOR_FACTOR +
    minor * VERSION_CODE_MINOR_FACTOR +
    patch
  )
}

module.exports = { getAndroidVersionCode }
