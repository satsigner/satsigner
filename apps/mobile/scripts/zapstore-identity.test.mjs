import assert from 'node:assert/strict'
import test from 'node:test'

import { KIND_IDENTITY_PROOF, activeProof } from './zapstore-identity.mjs'

const CERT_HASH =
  'e0d6e692fad1aa1626ff549acee347c2ebce8be50d0744cbd0d3a67539f27ed7'
const NOW = 1_800_000_000
const DAY = 86_400

function proof({
  certHash = CERT_HASH,
  expiresIn = 365 * DAY,
  extraTags = []
}) {
  return {
    id: `proof-${certHash}-${expiresIn}`,
    kind: KIND_IDENTITY_PROOF,
    tags: [
      ['d', certHash],
      ['signature', 'sig'],
      ['expiry', String(NOW + expiresIn)],
      ...extraTags
    ]
  }
}

test('finds a proof for this certificate that is not close to expiry', () => {
  const current = proof({})
  assert.equal(activeProof([current], CERT_HASH, NOW), current)
})

test('ignores proofs for another certificate, revoked or near expiry', () => {
  assert.equal(
    activeProof([proof({ certHash: 'other' })], CERT_HASH, NOW),
    undefined
  )
  assert.equal(
    activeProof(
      [proof({ extraTags: [['revoked', 'key lost']] })],
      CERT_HASH,
      NOW
    ),
    undefined
  )
  assert.equal(
    activeProof([proof({ expiresIn: 10 * DAY })], CERT_HASH, NOW),
    undefined
  )
})

test('ignores events of another kind', () => {
  assert.equal(
    activeProof([{ ...proof({}), kind: 1 }], CERT_HASH, NOW),
    undefined
  )
})
