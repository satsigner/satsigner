#!/usr/bin/env node
/**
 * Differential diagnosis for "one identity can't fetch follows/DMs, others can".
 *
 * The app resolves an identity's relay set three ways (utils/nostrContacts.ts):
 *   1. identity-pinned relays  (e.g. the security-report throwaway identity is
 *      pinned to NOSTR_LIVE_CHECK_FALLBACK_RELAYS at creation)
 *   2. store-wide relays       (landing page only)
 *   3. NostrAPI.INDEXING_RELAYS (imported identities with no pinned set)
 *
 * Imported accounts therefore read from big indexer relays while the
 * app-created (security report) account reads from the 13 fallback relays.
 * This script fetches kind-3 (follows) and kind-1059 (gift wraps / DMs) for
 * the SAME npub against each candidate set and prints per-relay connectivity,
 * EOSE behaviour and event counts — the exact data the in-app [nostrDebug]
 * logs produce, without needing a device.
 *
 * Usage:
 *   node scripts/nostr-diagnose.mjs <npub>
 *   NOSTR_DIAG_NPUB=npub1... node scripts/nostr-diagnose.mjs
 *
 * Optional: NOSTR_DIAG_NSEC=nsec1... to also count *decryptable* wraps
 * (proves whether wraps on a relay set are actually addressed to this key).
 */
import NDK from '@nostr-dev-kit/ndk'
import { nip19, nip59 } from 'nostr-tools'

// ── mirror of constants/nostr.ts ────────────────────────────────────────────
const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://offchain.pub',
  'wss://relay.primal.net',
  'wss://premium.primal.net',
  'wss://relay.0xchat.com',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://relay.nostr.bg',
  'wss://relay.nostrich.house',
  'wss://relay.hodlbod.com',
  'wss://relay.orangepill.dev',
  'wss://nostr.bitcoiner.social'
]

// mirror of NostrAPI.INDEXING_RELAYS (api/nostr.ts)
const INDEXING_RELAYS = [
  'wss://indexer.coracle.social',
  'wss://relay.nos.social',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://indexer.nostrarchives.com'
]

const CONNECT_TIMEOUT_MS = 20_000
const FETCH_TIMEOUT_MS = 15_000 // same as the app's fetchManyWithTimeout

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function decodeInputs() {
  const npub = process.argv[2] || process.env.NOSTR_DIAG_NPUB
  if (!npub?.startsWith('npub1')) {
    console.error('usage: node scripts/nostr-diagnose.mjs <npub>')
    process.exit(1)
  }
  const hexPubkey = nip19.decode(npub).data

  let secretKey = null
  const nsec = process.env.NOSTR_DIAG_NSEC
  if (nsec?.startsWith('nsec1')) {
    secretKey = nip19.decode(nsec).data
  }
  return { hexPubkey, npub, secretKey }
}

/** Mirrors NostrAPI.fetchManyWithTimeout: collect until all-relay EOSE or timeout. */
function fetchManyWithTimeout(ndk, filter, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false
    const collected = new Set()
    const perRelay = new Map()
    const sub = ndk.subscribe(filter, { closeOnEose: false })

    const finish = (reason) => {
      if (settled) {
        return
      }
      settled = true
      sub.stop()
      resolve({ collected, perRelay, reason })
    }

    sub.on('event', (event, relay) => {
      collected.add(event)
      if (relay?.url) {
        perRelay.set(relay.url, (perRelay.get(relay.url) ?? 0) + 1)
      }
    })
    sub.on('eose', () => {
      if (ndk.pool.connectedRelays().length > 0) {
        finish('eose')
      }
    })
    setTimeout(() => finish('timeout'), timeoutMs)
  })
}

async function probeSet(label, relayUrls, hexPubkey, secretKey) {
  console.log(`\n═══ ${label} (${relayUrls.length} relays) ═══`)
  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relayUrls
  })

  for (const [event, symbol] of [
    ['relay:connect', '+'],
    ['relay:disconnect', '−'],
    ['flapping', '!']
  ]) {
    ndk.pool.on(event, (relay) => console.log(`  ${symbol} ${relay.url}`))
  }
  ndk.pool.on('notice', (relay, notice) =>
    console.log(`  notice ${relay.url}: ${notice}`)
  )

  await ndk.connect(CONNECT_TIMEOUT_MS)
  const connected = ndk.pool.connectedRelays().map((r) => r.url)
  console.log(
    `  connected ${connected.length}/${relayUrls.length}: ${connected.join(' ') || '<none>'}`
  )
  if (connected.length === 0) {
    return { connected: 0, decryptable: 0, kind3: null, wraps: 0 }
  }

  // kind 3
  const kind3 = await fetchManyWithTimeout(
    ndk,
    { authors: [hexPubkey], kinds: [3], limit: 40 },
    FETCH_TIMEOUT_MS
  )
  const latest = [...kind3.collected].toSorted(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
  )[0]
  const pTags = latest
    ? latest.tags.filter((t) => t[0] === 'p' && /^[0-9a-f]{64}$/i.test(t[1]))
    : []
  console.log(
    `  kind3: ${kind3.collected.size} event(s), finish=${kind3.reason}` +
      (latest
        ? `, latest created_at=${latest.created_at} (${new Date(latest.created_at * 1000).toISOString()}), follows=${pTags.length}`
        : ', NO KIND3 FOUND')
  )

  // gift wraps (NIP-17 DMs)
  const wraps = await fetchManyWithTimeout(
    ndk,
    { '#p': [hexPubkey], kinds: [1059] },
    FETCH_TIMEOUT_MS
  )
  let decryptable = 0
  if (secretKey) {
    for (const event of wraps.collected) {
      try {
        nip59.unwrapEvent(await event.toNostrEvent(), secretKey)
        decryptable += 1
      } catch {
        // wrap for someone else sharing the p tag — not ours
      }
    }
  }
  console.log(
    `  kind1059: ${wraps.collected.size} wrap(s), finish=${wraps.reason}` +
      (secretKey ? `, decryptable-by-this-key=${decryptable}` : '') +
      `\n  per-relay wraps: ${[...wraps.perRelay.entries()].map(([u, n]) => `${u}=${n}`).join(' ') || '<none>'}`
  )

  ndk.pool.removeAllListeners()
  for (const relay of ndk.pool.relays.values()) {
    try {
      relay.disconnect()
    } catch {
      // best-effort
    }
  }
  return {
    connected: connected.length,
    decryptable,
    kind3: latest
      ? { created_at: latest.created_at, follows: pTags.length }
      : null,
    wraps: wraps.collected.size
  }
}

async function main() {
  const { hexPubkey, npub, secretKey } = decodeInputs()
  console.log(`npub:  ${npub}`)
  console.log(`hex:   ${hexPubkey}`)
  if (secretKey) {
    console.log('nsec:  provided (will test unwrap)')
  }

  const results = {}
  results.pinned = await probeSet(
    'IDENTITY-PINNED (security-report throwaway set)',
    FALLBACK_RELAYS,
    hexPubkey,
    secretKey
  )
  results.indexer = await probeSet(
    'INDEXER DEFAULT (imported identities)',
    INDEXING_RELAYS,
    hexPubkey,
    secretKey
  )

  console.log('\n═══ SUMMARY ═══')
  for (const [name, r] of Object.entries(results)) {
    console.log(
      `${name.padEnd(8)} connected=${r.connected} kind3=${r.kind3 ? `${r.kind3.follows} follows @ ${r.kind3.created_at}` : 'NOT FOUND'} wraps=${r.wraps}${secretKey ? ` decryptable=${r.decryptable}` : ''}`
    )
  }
  if (results.indexer.kind3 && !results.pinned.kind3) {
    console.log(
      '\n>> kind3 exists on the indexer set but NOT on the pinned set — the pinned identity can never load follows.'
    )
  }
  if (results.indexer.wraps > results.pinned.wraps) {
    console.log(
      `>> ${results.indexer.wraps - results.pinned.wraps} more gift wraps visible via the indexer set — DMs are landing on relays the pinned set does not subscribe.`
    )
  }
  process.exit(0)
}

main().catch((error) => {
  console.error('FAIL:', error?.message ?? error)
  process.exit(1)
})
