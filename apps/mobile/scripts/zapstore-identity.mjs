import { SimplePool } from 'nostr-tools/pool'

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

function activeProof(events, certHash, nowSeconds) {
  return events.find(
    (event) =>
      event.kind === KIND_IDENTITY_PROOF &&
      tagValue(event, 'd') === certHash &&
      tagValue(event, 'revoked') === undefined &&
      Number(tagValue(event, 'expiry')) > nowSeconds + RENEW_BEFORE_SECONDS
  )
}

async function findProofs(pubkey, certHash) {
  const pool = new SimplePool()
  try {
    return await pool.querySync(
      IDENTITY_RELAYS,
      { '#d': [certHash], authors: [pubkey], kinds: [KIND_IDENTITY_PROOF] },
      { maxWait: QUERY_MAX_WAIT_MS }
    )
  } finally {
    pool.close(IDENTITY_RELAYS)
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

async function ensureIdentityProof({ certHash, pubkey, signProof }) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const existing = activeProof(
    await findProofs(pubkey, certHash),
    certHash,
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
  if (!activeProof([proof], certHash, nowSeconds)) {
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
