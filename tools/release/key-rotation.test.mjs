import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { parseSigners } from './apk-review.mjs'
import { applyKeyRotation, findApksigner, writeLineage } from './apk-signer.mjs'
import {
  hasRotation,
  newestSignerDir,
  releaseKeyStatus,
  writeKeystore
} from './keystore.mjs'

const PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const NEXT_PHRASE =
  'legal winner thank year wave sausage worth useful legal winner thank yellow'
const PHRASE_CERTIFICATE_SHA256 =
  '14:B5:17:E1:28:C8:D2:8C:D7:0E:21:BE:01:9D:A1:FC:4C:7B:04:FE:20:7C:9E:E1:1B:56:0B:AC:51:6E:DC:41'
const NEXT_CERTIFICATE_SHA256 =
  'ac76436f4cdf7a110fdc266bfe4d9f0717071d6ccc68119685a1d305ffe759dc'
const APK_DIR = new URL('../../apps/mobile/dist/apks/', import.meta.url)
  .pathname

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'satsigner-rotation-'))
  t.after(() => rmSync(dir, { force: true, recursive: true }))
  return dir
}

function apksignerPath() {
  try {
    return findApksigner()
  } catch {
    return ''
  }
}

function sampleApk() {
  try {
    const name = readdirSync(APK_DIR).find((file) => file.endsWith('.apk'))
    return name ? join(APK_DIR, name) : ''
  } catch {
    return ''
  }
}

test('status reports a missing keystore', (t) => {
  const status = releaseKeyStatus(tempDir(t))
  assert.equal(status.current.present, false)
  assert.equal(status.current.matchesRelease, false)
  assert.equal(status.rotating, false)
})

test('status shows the certificate and that it is not the release key', (t) => {
  const dir = tempDir(t)
  writeKeystore(PHRASE, dir)
  const status = releaseKeyStatus(dir)
  assert.equal(status.current.fingerprint, PHRASE_CERTIFICATE_SHA256)
  assert.equal(status.current.matchesRelease, false)
  assert.equal(status.next.present, false)
})

test('a new key without a lineage is not a rotation', (t) => {
  const dir = tempDir(t)
  writeKeystore(PHRASE, dir)
  writeKeystore(NEXT_PHRASE, join(dir, 'next'))
  assert.equal(hasRotation(dir), false)
  assert.equal(newestSignerDir(dir), dir)
})

test(
  'rotation signs the apk with the new key linked to the old one',
  { skip: !apksignerPath() || !sampleApk() },
  (t) => {
    const dir = tempDir(t)
    writeKeystore(PHRASE, dir)
    writeKeystore(NEXT_PHRASE, join(dir, 'next'))
    writeLineage(dir)
    assert.equal(hasRotation(dir), true)
    assert.equal(newestSignerDir(dir), join(dir, 'next'))

    const apk = join(dir, 'app.apk')
    copyFileSync(sampleApk(), apk)
    assert.equal(applyKeyRotation(apk, dir), true)

    const report = execFileSync(
      apksignerPath(),
      ['verify', '--print-certs', '-v', apk],
      { encoding: 'utf8' }
    )
    assert.match(report, /Verified using v3\.1 scheme.*: true/)
    assert.deepEqual(
      [
        ...new Set(parseSigners(report).map((signer) => signer.sha256))
      ].toSorted(),
      [
        PHRASE_CERTIFICATE_SHA256.replaceAll(':', '').toLowerCase(),
        NEXT_CERTIFICATE_SHA256
      ]
    )
    assert.match(
      report,
      new RegExp(`certificate SHA-256 digest: ${NEXT_CERTIFICATE_SHA256}`)
    )
  }
)

test('without a rotation the apk is left alone', (t) => {
  const dir = tempDir(t)
  writeKeystore(PHRASE, dir)
  assert.equal(applyKeyRotation(join(dir, 'missing.apk'), dir), false)
})
