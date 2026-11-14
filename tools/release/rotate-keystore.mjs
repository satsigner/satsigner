import { rmSync } from 'node:fs'

import { findApksigner, writeLineage } from './apk-signer.mjs'
import { certificateFingerprint } from './certificate.mjs'
import { readHiddenLine } from './hidden-prompt.mjs'
import {
  createMnemonic,
  hasReleaseKeystore,
  keystorePath,
  lineagePath,
  nextKeystorePath,
  nextReleaseDir,
  storedFingerprint,
  writeKeystore
} from './keystore.mjs'

const restore = process.argv.includes('--restore')
const force = process.argv.includes('--force')

if (!hasReleaseKeystore()) {
  console.error(`No release keystore at ${keystorePath}`)
  console.error('Rotation needs the current key. Restore it first with:')
  console.error('  pnpm --dir tools/release keystore:restore')
  process.exit(1)
}

if (hasReleaseKeystore(nextReleaseDir) && !force) {
  console.error(`A rotated key already exists at ${nextKeystorePath}`)
  console.error(
    'Pass --force to replace it. Phones that installed a build signed with it will refuse builds signed with another one.'
  )
  process.exit(1)
}

try {
  findApksigner()
} catch (error) {
  console.error(error.message)
  console.error(
    'Rotation signs the lineage with apksigner from the Android SDK build-tools.'
  )
  process.exit(1)
}

console.log(`Current certificate SHA-256: ${storedFingerprint()}`)

const phrase = restore
  ? await readHiddenLine('12 words of the new key: ')
  : createMnemonic()

// A lineage left from a replaced key would mark the rotation active while it
// links another certificate, should the new lineage fail to write.
rmSync(lineagePath, { force: true })
const { certificate } = writeKeystore(phrase, nextReleaseDir)

// Show the words before the lineage step: if apksigner fails there, the new
// key is already on disk and `--restore --force` needs them to finish.
if (!restore) {
  console.log('')
  console.log(phrase)
  console.log('')
  console.log(
    'Write these 12 words down. They are the backup of the NEW Android key.'
  )
  console.log(
    'Keep the old 12 words too: every release keeps signing with both keys.'
  )
}

writeLineage()

console.log(`New keystore: ${nextKeystorePath}`)
console.log(`Lineage:      ${lineagePath}`)
console.log(`New certificate SHA-256: ${certificateFingerprint(certificate)}`)
console.log('')
console.log(
  'Release builds now carry both keys. Publish once from the release page so zsp links the new certificate to your npub.'
)
