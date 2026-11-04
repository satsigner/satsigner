const NO_RELEASE_KEYSTORE =
  'No Android release keystore at ~/.satsigner/release.p12.\n' +
  'Create one with: pnpm --dir tools/release keystore\n' +
  'Write down the 12 words. Zapstore rejects the public debug key.'

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

export { assertChannelCanPublish }
