import { nip44 } from 'nostr-tools'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import {
  NOSTR_CHAT_CATCH_UP_LIMIT,
  NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { listChatThread } from '@/db/queries/nostrChat'
import {
  acquireChatPipeline,
  type ChatIdentity,
  clearRecipientRelaysCache,
  closeActiveChatPipeline,
  getChatPipelineStatus,
  sendNip17Chat
} from '@/utils/nostrChat'

import {
  createTestIdentity,
  type TestIdentity,
  wrapChatMessage
} from './support/identities'
import { resetNodeNitroSqlite } from './support/nodeNitroSqlite'
import { startTestRelay, type TestRelay } from './support/testRelay'
import { delay, waitFor } from './support/waitFor'

const STORED_MESSAGE_COUNT = 50
const HISTORY_AGE_SEC = 600
const GIFT_WRAP_KIND = 1059
const THREAD_LIMIT = 500
const CHAT_WAIT_MS = 20_000
const OTHER_DEVICE_WAIT_MS = 5000
const REFUSED_CONNECT_WAIT_MS = 30_000
const SCENARIO_TIMEOUT_MS = 60_000
const SETTLE_MS = 500
const NIP44_LAYERS_PER_WRAP = 2

function nowSec() {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function chatIdentity(identity: TestIdentity, relays: string[]): ChatIdentity {
  return { npub: identity.npub, nsec: identity.nsec, relays }
}

function thread(owner: TestIdentity, peer: TestIdentity) {
  return listChatThread(owner.npub, 'nip17', peer.pubkey, THREAD_LIMIT)
}

function giftWrapReqsFor(relay: TestRelay, recipient: TestIdentity) {
  return relay
    .reqLog()
    .filter(({ filters }) =>
      filters.some(
        (filter) =>
          filter.kinds?.includes(GIFT_WRAP_KIND) &&
          filter['#p']?.includes(recipient.pubkey)
      )
    )
}

function waitForPipelineState(
  identity: TestIdentity,
  state: 'error' | 'live',
  timeoutMs = CHAT_WAIT_MS
) {
  return waitFor(() => getChatPipelineStatus(identity.npub).state === state, {
    label: `pipeline ${state}`,
    timeoutMs
  })
}

describe('chat pipeline against the test relay', () => {
  const state: { relay?: TestRelay } = {}

  function relay() {
    if (!state.relay) {
      throw new Error('relay not started')
    }
    return state.relay
  }

  beforeEach(async () => {
    resetRelayHealth()
    clearRecipientRelaysCache()
    // Inbox relay discovery would reach the public indexing relays.
    jest
      .spyOn(NostrAPI.prototype, 'fetchInboxRelaysForNpub')
      .mockResolvedValue([])
    state.relay = await startTestRelay()
  })

  afterEach(async () => {
    closeActiveChatPipeline()
    clearNdkRegistry()
    await state.relay?.stop()
    jest.restoreAllMocks()
  })

  afterAll(() => {
    resetNodeNitroSqlite()
  })

  it(
    'reopening a chat catches up with since and decrypts no stored wrap again',
    async () => {
      const owner = createTestIdentity()
      const peer = createTestIdentity()
      const base = nowSec() - HISTORY_AGE_SEC
      const createdAts = Array.from(
        { length: STORED_MESSAGE_COUNT },
        (_, index) => base + index
      )
      relay().seed(
        createdAts.map((createdAt, index) =>
          wrapChatMessage(peer, owner, createdAt, `message ${index}`)
        )
      )
      const identity = chatIdentity(owner, [relay().url])
      const decrypt = jest.spyOn(nip44.v2, 'decrypt')

      const first = acquireChatPipeline(identity)
      await first.ready
      await waitFor(() => thread(owner, peer).length === STORED_MESSAGE_COUNT, {
        label: 'history stored',
        timeoutMs: CHAT_WAIT_MS
      })
      await delay(SETTLE_MS)
      first.release()

      expect(decrypt).toHaveBeenCalledTimes(
        STORED_MESSAGE_COUNT * NIP44_LAYERS_PER_WRAP
      )
      expect(
        giftWrapReqsFor(relay(), owner)[0]?.filters[0]?.since
      ).toBeUndefined()

      decrypt.mockClear()
      const reqsBeforeReopen = giftWrapReqsFor(relay(), owner).length
      const second = acquireChatPipeline(identity)
      await second.ready
      await waitForPipelineState(owner, 'live')
      await delay(SETTLE_MS)
      second.release()

      const [reopenFilter] =
        giftWrapReqsFor(relay(), owner).at(reqsBeforeReopen)?.filters ?? []
      const newest = createdAts.at(-1) ?? 0
      expect(reopenFilter?.since).toBe(
        newest - NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
      )
      expect(reopenFilter?.limit).toBe(NOSTR_CHAT_CATCH_UP_LIMIT)
      expect(decrypt).not.toHaveBeenCalled()
      expect(thread(owner, peer)).toHaveLength(STORED_MESSAGE_COUNT)
    },
    SCENARIO_TIMEOUT_MS
  )

  it(
    'reports noRelays while the relay refuses and goes live on retry once it is back',
    async () => {
      const owner = createTestIdentity()
      const identity = chatIdentity(owner, [relay().url])
      relay().setFault({ type: 'refuse' })

      const refused = acquireChatPipeline(identity)
      await refused.ready

      expect(getChatPipelineStatus(owner.npub)).toStrictEqual({
        errorCode: 'noRelays',
        state: 'error'
      })

      relay().setFault(null)
      const retry = acquireChatPipeline(identity)
      await retry.ready
      await waitForPipelineState(owner, 'live')

      expect(giftWrapReqsFor(relay(), owner)).toHaveLength(1)
      retry.release()
      refused.release()
    },
    SCENARIO_TIMEOUT_MS + REFUSED_CONNECT_WAIT_MS
  )

  async function sendBetweenTwoIdentities() {
    const sender = createTestIdentity()
    const receiver = createTestIdentity()
    const text = `hello over nip17 ${Date.now()}`
    const lease = acquireChatPipeline(chatIdentity(receiver, [relay().url]))
    await lease.ready
    await waitForPipelineState(receiver, 'live')

    await sendNip17Chat(
      new NostrAPI([relay().url]),
      chatIdentity(sender, [relay().url]),
      receiver.npub,
      text
    )
    await waitFor(() => thread(receiver, sender).length === 1, {
      label: 'message received',
      timeoutMs: CHAT_WAIT_MS
    })
    lease.release()
    return { receiver, sender, text }
  }

  it(
    'delivers a NIP-17 message sent through the relay to the receiving identity',
    async () => {
      const { receiver, sender, text } = await sendBetweenTwoIdentities()

      expect(thread(receiver, sender)).toMatchObject([
        {
          content: text,
          direction: 'in',
          peerPubkey: sender.pubkey,
          read: false,
          status: 'sent'
        }
      ])
      expect(thread(sender, receiver)).toMatchObject([
        { content: text, direction: 'out', status: 'sent' }
      ])
    },
    SCENARIO_TIMEOUT_MS
  )

  // NIP-17 seals the same rumor (p = peer) for every recipient, sender
  // included, so the self copy lands in the peer thread on other devices.
  it(
    "files the sender's self copy under the peer thread on the sender's other device",
    async () => {
      const { receiver, sender, text } = await sendBetweenTwoIdentities()
      resetNodeNitroSqlite()

      const otherDevice = acquireChatPipeline(
        chatIdentity(sender, [relay().url])
      )
      await otherDevice.ready
      await waitFor(() => thread(sender, receiver).length === 1, {
        label: 'self copy synced',
        timeoutMs: OTHER_DEVICE_WAIT_MS
      }).catch(() => undefined)
      otherDevice.release()

      expect(thread(sender, receiver)).toMatchObject([
        { content: text, direction: 'out', status: 'sent' }
      ])
      expect(thread(sender, sender)).toHaveLength(0)
    },
    SCENARIO_TIMEOUT_MS
  )
})
