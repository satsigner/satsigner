import type NDK from '@nostr-dev-kit/ndk'
import {
  type NDKEvent,
  type NDKFilter,
  type NDKRelay
} from '@nostr-dev-kit/ndk'

import { createEphemeralNdk, disconnectNdkPool } from '@/api/ndkRegistry'
import { connectToFirstRelay } from '@/api/nostrRelayHealth'
import {
  NOSTR_COLLECT_ANSWER_CHECK_MS,
  NOSTR_COLLECT_CONNECT_TIMEOUT_MS,
  NOSTR_COLLECT_TIMEOUT_MS
} from '@/constants/nostr'
import { NostrNoRelaysError, NostrRelayTimeoutError } from '@/utils/errors'

type CollectOptions = {
  /**
   * Connect to every relay and wait for each one's EOSE or CLOSED instead of
   * stopping on NDK's EOSE, which fires once enough relays answered. Use it
   * when missing a slow relay's newer event would lose data.
   */
  waitForEveryRelay?: boolean
}

/**
 * Collects events until every connected relay has answered (EOSE or CLOSED).
 * Ending with nothing collected and no EOSE throws NostrRelayTimeoutError, so
 * an outage never looks like "no events".
 */
function subscribeAndCollect(
  ndk: NDK,
  filter: NDKFilter,
  { waitForEveryRelay = false }: CollectOptions
): Promise<Set<NDKEvent>> {
  return new Promise((resolve, reject) => {
    const state = { settled: false }
    const collected = new Set<NDKEvent>()
    const closedRelayUrls = new Set<string>()
    const sub = ndk.subscribe(filter, { closeOnEose: false })

    function finish(answered: boolean) {
      if (state.settled) {
        return
      }
      state.settled = true
      clearTimeout(timer)
      clearInterval(answerCheck)
      sub.stop()
      if (!answered && collected.size === 0) {
        reject(new NostrRelayTimeoutError('No relay answered the REQ'))
        return
      }
      resolve(collected)
    }

    function haveConnectedRelaysAnswered() {
      const answeredUrls = new Set([
        ...closedRelayUrls,
        ...[...sub.eosesSeen].map((relay) => relay.url)
      ])
      const connected = ndk.pool.connectedRelays()
      return (
        connected.length > 0 &&
        connected.every((relay) => answeredUrls.has(relay.url))
      )
    }

    const timer = setTimeout(
      () => finish(sub.eosesSeen.size > 0),
      NOSTR_COLLECT_TIMEOUT_MS
    )

    sub.on('event', (event: NDKEvent) => {
      collected.add(event)
    })
    sub.on('eose', () => {
      if (!waitForEveryRelay && ndk.pool.connectedRelays().length > 0) {
        finish(true)
      }
    })
    sub.on('closed', (relay: NDKRelay) => {
      closedRelayUrls.add(relay.url)
    })
    // NDK only emits EOSE once enough relays sent one, and relays that refuse
    // the kind (CLOSED) never send it, so check every relay's answer here.
    // Only CLOSED answers (rate limit, auth, …) count as an outage.
    const answerCheck = setInterval(() => {
      if (haveConnectedRelaysAnswered()) {
        finish(sub.eosesSeen.size > 0)
      }
    }, NOSTR_COLLECT_ANSWER_CHECK_MS)
  })
}

/** One short-lived pool per query; always torn down. */
async function collectFromRelays(
  relays: string[],
  filter: NDKFilter,
  options: CollectOptions = {}
): Promise<Set<NDKEvent>> {
  if (relays.length === 0) {
    throw new NostrNoRelaysError('No relays configured')
  }
  const ndk = createEphemeralNdk(relays)
  try {
    await (options.waitForEveryRelay
      ? ndk.connect(NOSTR_COLLECT_CONNECT_TIMEOUT_MS)
      : connectToFirstRelay(ndk, NOSTR_COLLECT_CONNECT_TIMEOUT_MS))
    return await subscribeAndCollect(ndk, filter, options)
  } finally {
    disconnectNdkPool(ndk)
  }
}

export { collectFromRelays }
