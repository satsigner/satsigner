import { certificateFingerprint } from './certificate.mjs'
import { readHiddenLine } from './hidden-prompt.mjs'
import {
  RELEASE_CERT_SHA256,
  hasReleaseKeystore,
  keystoreFiles,
  nextReleaseDir,
  phraseMatchesKeystore,
  releaseDir,
  storedIdentity
} from './keystore.mjs'

const dir = process.argv.includes('--next') ? nextReleaseDir : releaseDir
const { keystore } = keystoreFiles(dir)

if (!hasReleaseKeystore(dir)) {
  console.error(`No release keystore at ${keystore}`)
  process.exit(1)
}

const fingerprint = certificateFingerprint(storedIdentity(dir).certificate)
console.log(`Keystore: ${keystore}`)
console.log(`Certificate SHA-256: ${fingerprint}`)
if (dir === releaseDir && fingerprint !== RELEASE_CERT_SHA256) {
  console.log(
    `Warning: this is not the Satsigner release key (${RELEASE_CERT_SHA256}).`
  )
}

const phrase = await readHiddenLine('12 words: ')

try {
  const matches = phraseMatchesKeystore(phrase, dir)
  if (!matches) {
    console.error('These words are valid, but they do not match this keystore.')
    process.exit(1)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

console.log('These words match this keystore.')
