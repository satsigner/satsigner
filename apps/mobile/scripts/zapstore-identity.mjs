import { X509Certificate, createHash, verify } from 'node:crypto'

import { SimplePool } from 'nostr-tools/pool'
import { verifyEvent } from 'nostr-tools/pure'

// NIP-C1: a kind 30509 event, keyed by the APK certificate hash, proves that
// the npub controls the Android signing key. Zapstore holds releases signed
// by a certificate without one as pending.
const KIND_IDENTITY_PROOF = 30509
const IDENTITY_RELAYS = [
  'wss://relay.zapstore.dev',
  'wss://relay.primal.net',
  'wss://relay.damus.io'
]
const REQUIRED_RELAY = 'wss://relay.zapstore.dev'
const QUERY_MAX_WAIT_MS = 8000
const SECONDS_PER_DAY = 86_400
const RENEW_BEFORE_SECONDS = 30 * SECONDS_PER_DAY

function tagValue(event, name) {
  return event.tags.find((tag) => tag[0] === name)?.[1]
}

function proofMessage(event) {
  return `Verifying at ${event.created_at} until ${tagValue(event, 'expiry')} that I control the following Nostr public key: ${event.pubkey}`
}

function certificateSigned(event, certKey) {
  const signature = tagValue(event, 'signature')
  if (!signature) {
    return false
  }
  return verify(
    'sha256',
    Buffer.from(proofMessage(event)),
    { dsaEncoding: 'der', key: certKey },
    Buffer.from(signature, 'base64')
  )
}

function activeProof(events, { certHash, certKey, pubkey }, nowSeconds) {
  return events.find(
    (event) =>
      event.kind === KIND_IDENTITY_PROOF &&
      event.pubkey === pubkey &&
      tagValue(event, 'd') === certHash &&
      tagValue(event, 'revoked') === undefined &&
      Number(tagValue(event, 'expiry')) > nowSeconds + RENEW_BEFORE_SECONDS &&
      verifyEvent(event) &&
      certificateSigned(event, certKey)
  )
}

async function findProofs(pubkey, certHash) {
  const pool = new SimplePool()
  try {
    return await pool.querySync(
      [REQUIRED_RELAY],
      { '#d': [certHash], authors: [pubkey], kinds: [KIND_IDENTITY_PROOF] },
      { maxWait: QUERY_MAX_WAIT_MS }
    )
  } finally {
    pool.close([REQUIRED_RELAY])
  }
}

async function publishProof(event) {
  const pool = new SimplePool()
  try {
    const results = await Promise.allSettled(
      pool.publish(IDENTITY_RELAYS, event)
    )
    return IDENTITY_RELAYS.map((relay, index) => ({
      reason: results[index].reason?.message ?? results[index].reason,
      relay,
      saved: results[index].status === 'fulfilled'
    }))
  } finally {
    pool.close(IDENTITY_RELAYS)
  }
}

function expiryDate(event) {
  return new Date(Number(tagValue(event, 'expiry')) * 1000)
    .toISOString()
    .slice(0, 10)
}

function certificateIdentity(certificate, pubkey) {
  return {
    certHash: createHash('sha256').update(certificate).digest('hex'),
    certKey: new X509Certificate(certificate).publicKey,
    pubkey
  }
}

async function ensureIdentityProof({ certificate, pubkey, signProof }) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const identity = certificateIdentity(certificate, pubkey)
  const existing = activeProof(
    await findProofs(pubkey, identity.certHash),
    identity,
    nowSeconds
  )
  if (existing) {
    console.log(
      `  ok      Signing key already linked to your npub (until ${expiryDate(existing)})`
    )
    return
  }

  console.log('  Linking the signing key to your npub. Approve the signature.')
  const proof = await signProof()
  if (!activeProof([proof], identity, nowSeconds)) {
    throw new Error('zsp did not return an identity proof for this key')
  }
  const results = await publishProof(proof)
  for (const { reason, relay, saved } of results) {
    console.log(
      saved ? `    ok      ${relay}` : `    missing ${relay}: ${reason}`
    )
  }
  if (!results.some(({ relay, saved }) => saved && relay === REQUIRED_RELAY)) {
    throw new Error(`${REQUIRED_RELAY} did not save the identity proof`)
  }
  console.log(`  ok      Signing key linked until ${expiryDate(proof)}`)
}

export { KIND_IDENTITY_PROOF, activeProof, ensureIdentityProof }
