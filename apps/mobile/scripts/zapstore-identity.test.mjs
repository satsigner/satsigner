import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import test from 'node:test'

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey
} from 'nostr-tools/pure'

import { KIND_IDENTITY_PROOF, activeProof } from './zapstore-identity.mjs'

const CERT_HASH =
  'e0d6e692fad1aa1626ff549acee347c2ebce8be50d0744cbd0d3a67539f27ed7'
const NOW = 1_800_000_000
const DAY = 86_400

const nostrKey = generateSecretKey()
const certKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const otherCertKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const identity = {
  certHash: CERT_HASH,
  certKey: certKeys.publicKey,
  pubkey: getPublicKey(nostrKey)
}

function certificateSignature(createdAt, expiry, privateKey) {
  const message = `Verifying at ${createdAt} until ${expiry} that I control the following Nostr public key: ${getPublicKey(nostrKey)}`
  return sign('sha256', Buffer.from(message), {
    dsaEncoding: 'der',
    key: privateKey
  }).toString('base64')
}

function proof({
  certHash = CERT_HASH,
  certPrivateKey = certKeys.privateKey,
  expiresIn = 365 * DAY,
  extraTags = [],
  kind = KIND_IDENTITY_PROOF,
  withSignature = true
}) {
  const expiry = NOW + expiresIn
  const signatureTags = withSignature
    ? [['signature', certificateSignature(NOW, expiry, certPrivateKey)]]
    : []
  return finalizeEvent(
    {
      content: '',
      created_at: NOW,
      kind,
      tags: [
        ['d', certHash],
        ...signatureTags,
        ['expiry', String(expiry)],
        ...extraTags
      ]
    },
    nostrKey
  )
}

test('finds a proof for this certificate that is not close to expiry', () => {
  const current = proof({})
  assert.equal(activeProof([current], identity, NOW), current)
})

test('ignores proofs for another certificate, revoked or near expiry', () => {
  assert.equal(
    activeProof([proof({ certHash: 'other' })], identity, NOW),
    undefined
  )
  assert.equal(
    activeProof(
      [proof({ extraTags: [['revoked', 'key lost']] })],
      identity,
      NOW
    ),
    undefined
  )
  assert.equal(
    activeProof([proof({ expiresIn: 10 * DAY })], identity, NOW),
    undefined
  )
})

test('ignores events of another kind', () => {
  assert.equal(activeProof([proof({ kind: 1 })], identity, NOW), undefined)
})

test('ignores a proof without a certificate signature', () => {
  assert.equal(
    activeProof([proof({ withSignature: false })], identity, NOW),
    undefined
  )
})

test('ignores a proof signed by another certificate key', () => {
  assert.equal(
    activeProof(
      [proof({ certPrivateKey: otherCertKeys.privateKey })],
      identity,
      NOW
    ),
    undefined
  )
})

test('ignores a proof whose nostr signature does not match', () => {
  const relayed = JSON.parse(JSON.stringify(proof({})))
  const forged = { ...relayed, sig: proof({ expiresIn: 400 * DAY }).sig }
  assert.equal(activeProof([forged], identity, NOW), undefined)
})

test('ignores a proof from another npub', () => {
  const stranger = { ...identity, pubkey: getPublicKey(generateSecretKey()) }
  assert.equal(activeProof([proof({})], stranger, NOW), undefined)
})
