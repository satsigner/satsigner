const PRODUCTION_CHANNEL = 'primary'

const NO_RELEASE_KEYSTORE =
  'No Android release keystore at ~/.satsigner/release.p12.\n' +
  'Create one with: pnpm --dir tools/release keystore\n' +
  'Write down the 12 words. Zapstore rejects the public debug key.'

const PRODUCTION_NOT_CONFIRMED =
  'Publishing to Production needs a deliberate confirmation.\n' +
  'Run it from a terminal and type the version, or confirm it in the release console.'

/**
 * Every Zapstore channel needs the release keystore: Zapstore rejects the
 * public debug key, and a production APK signed with it would let anyone
 * push a spoofed update over the official app. With the keystore in place,
 * production builds are signed with the same key as every other release.
 */
function assertChannelCanPublish({ hasKeystore }) {
  if (!hasKeystore) {
    throw new Error(NO_RELEASE_KEYSTORE)
  }
}

function assertProductionConfirmed({ channel, confirmedVersion, version }) {
  if (channel !== PRODUCTION_CHANNEL) {
    return
  }
  if (typeof confirmedVersion !== 'string' || confirmedVersion === '') {
    throw new Error(PRODUCTION_NOT_CONFIRMED)
  }
  if (confirmedVersion.trim() !== version) {
    throw new Error(
      `Production confirmation "${confirmedVersion}" does not match v${version}. Nothing was published.`
    )
  }
}

export {
  PRODUCTION_CHANNEL,
  assertChannelCanPublish,
  assertProductionConfirmed
}
