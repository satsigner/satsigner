#!/usr/bin/env node
/**
 * Live NIP-17 roundtrip through the app's exact NDK configuration — the
 * coverage jest cannot give (NDK hangs in the jest environment).
 *
 * Phases:
 *   1. connect + subscribe to gift wraps for a receiver identity
 *   2. publish a kind-14 chat wrap from a second identity
 *   3. assert live delivery + NIP-59 unwrap to the exact payload
 *   4. restart with a FRESH NDK instance and assert the wrap is retrievable
 *      from relay history (relay persistence across disconnects)
 *
 * Run:  pnpm --filter satsigner-mobile test:int:nostr
 * Exit 0 = full pass, 1 = failure, 2 = relays unreachable (environmental skip)
 */
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk'
import { generateSecretKey, getPublicKey, nip17, nip59 } from 'nostr-tools'

const RELAYS = process.env.NOSTR_TEST_RELAYS
  ? process.env.NOSTR_TEST_RELAYS.split(',')
  : [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://relay.primal.net',
      'wss://nos.lol',
      'wss://offchain.pub'
    ]

const CONNECT_TIMEOUT_MS = 25_000
const DELIVERY_WINDOW_MS = 20_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function createNdk() {
  return new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: RELAYS
  })
}

async function main() {
  const receiverSk = generateSecretKey()
  const receiverPub = getPublicKey(receiverSk)
  const senderSk = generateSecretKey()
  const probe = `roundtrip ${Date.now()}`

  // Phase 1: connect + subscribe (mirrors subscribeToKind1059)
  const ndk = createNdk()
  await ndk.connect(CONNECT_TIMEOUT_MS)
  const connected = ndk.pool.connectedRelays().map((r) => r.url)
  console.log(`connected: ${connected.length}/${RELAYS.length}`)
  if (connected.length === 0) {
    console.log('SKIP: no relays reachable')
    process.exit(2)
  }

  let received = null
  const sub = ndk.subscribe(
    { '#p': [receiverPub], kinds: [1059] },
    { closeOnEose: false }
  )
  sub.on('event', async (e) => {
    try {
      const rumor = nip59.unwrapEvent(await e.toNostrEvent(), receiverSk)
      if (rumor.kind === 14 && rumor.content === probe) {
        received = rumor
      }
    } catch {
      // foreign/undecryptable wraps are ignored
    }
  })

  // Phase 2: publish from the sender identity (mirrors createKind1059 +
  // publishEvent: wrap is pre-signed, publish to connected relays)
  const wrap = nip17.wrapEvent(senderSk, { publicKey: receiverPub }, probe)
  const event = new NDKEvent(ndk, wrap)
  const published = await Promise.allSettled(
    ndk.pool.connectedRelays().map((r) => r.publish(event))
  ).then((rs) => rs.filter((r) => r.status === 'fulfilled').length)
  console.log(`published to ${published} relay(s)`)
  if (published === 0) {
    console.log('FAIL: publish rejected by all relays')
    process.exit(1)
  }

  // Phase 3: live delivery
  const deadline = Date.now() + DELIVERY_WINDOW_MS
  while (!received && Date.now() < deadline) {
    await sleep(500)
  }
  if (!received) {
    console.log('FAIL: wrap never arrived on the subscription')
    process.exit(1)
  }
  console.log(
    `live delivery ok (rumor kind ${received.kind}, sender matches: ${received.pubkey === getPublicKey(senderSk)})`
  )

  // Phase 4: fresh NDK instance — relay history must survive disconnects
  sub.stop()
  const ndk2 = createNdk()
  await ndk2.connect(CONNECT_TIMEOUT_MS)
  const historical = await ndk2.fetchEvent({ ids: [wrap.id] })
  if (!historical) {
    console.log('FAIL: wrap not retrievable after reconnect')
    process.exit(1)
  }
  const rewrapped = nip59.unwrapEvent(
    await historical.toNostrEvent(),
    receiverSk
  )
  if (rewrapped.content !== probe) {
    console.log('FAIL: re-fetched wrap unwraps to different content')
    process.exit(1)
  }
  console.log('relay persistence ok (retrievable after fresh connect)')

  console.log('FULL ROUNDTRIP PASS')
  process.exit(0)
}

main().catch((error) => {
  console.error('FAIL:', error?.message ?? error)
  process.exit(1)
})
