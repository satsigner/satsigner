// Values that app.config.ts reads during prebuild, plus the EXPO_PUBLIC_*
// values Expo inlines into the JS bundle. A change to any of them changes the
// APK, so they belong in the source fingerprint.
const BUILD_ENV_NAMES = [
  'APP_VARIANT',
  'APP_VARIANT_SUFFIX',
  'EXPO_PROJECT_ID',
  'EXPO_PUBLIC_STORYBOOK_ENABLED'
]
const INLINED_ENV_PREFIX = 'EXPO_PUBLIC_'

// Expo loads these at build time, and git ignores them, so the source diff
// does not cover them.
const LOCAL_ENV_FILES = [
  '.env.local',
  '.env.development.local',
  '.env.production.local'
]

function buildEnvEntries(env) {
  return Object.keys(env)
    .filter(
      (name) =>
        BUILD_ENV_NAMES.includes(name) || name.startsWith(INLINED_ENV_PREFIX)
    )
    .filter((name) => typeof env[name] === 'string')
    .toSorted()
    .map((name) => [name, env[name]])
}

export { LOCAL_ENV_FILES, buildEnvEntries }
