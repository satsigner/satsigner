import { findApksigner } from './apk-signer.mjs'
import { releaseKeyStatus } from './keystore.mjs'

function describeKey(label, key) {
  if (!key.present) {
    return `${label}: none at ${key.path}`
  }
  if (key.error) {
    return `${label}: ${key.path} cannot be read: ${key.error}`
  }
  return `${label}: ${key.path}\n  Certificate SHA-256: ${key.fingerprint}`
}

function apksignerLine() {
  try {
    return `apksigner: ${findApksigner()}`
  } catch (error) {
    return `apksigner: ${error.message}`
  }
}

const status = releaseKeyStatus()

console.log(describeKey('Release key', status.current))
if (status.current.fingerprint) {
  console.log(
    status.current.matchesRelease
      ? '  This is the key Satsigner releases are signed with.'
      : `  This is NOT the Satsigner release key (${status.expectedFingerprint}).`
  )
}
console.log(describeKey('Rotated key', status.next))
console.log(
  status.rotating
    ? 'Rotation: active. Release builds are signed with both keys.'
    : 'Rotation: none.'
)
if (status.next.present && !status.lineage) {
  console.log(
    '  The rotated key has no lineage. Rebuild it with: pnpm --dir tools/release keystore:rotate --restore --force'
  )
}
console.log(apksignerLine())

process.exit(status.current.present && !status.current.error ? 0 : 1)
