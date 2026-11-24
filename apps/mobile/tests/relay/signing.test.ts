import { nip59, verifyEvent } from 'nostr-tools'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import { MS_PER_SECOND } from '@/constants/time'
import { listSignRequestBatch } from '@/db/signRequests'
import {
  approveChatSignRequests,
  rejectChatSignRequests
} from '@/utils/chatSignAnswers'
import {
  acquireChatPipeline,
  clearRecipientRelaysCache,
  closeActiveChatPipeline,
  getChatPipelineStatus,
  sendNip17Chat
} from '@/utils/nostrChat'
import type { ChatIdentity } from '@/utils/nostrChat'
import { startChatSession } from '@/utils/nostrChatSessions'
import { parseNostrEvent } from '@/utils/nostrEvent'

import { createTestIdentity } from './support/identities'
import type { TestIdentity } from './support/identities'
import { resetNodeNitroSqlite } from './support/nodeNitroSqlite'
import { startTestRelay } from './support/testRelay'
import type { TestRelay } from './support/testRelay'
import { waitFor } from './support/waitFor'

const WAIT_MS = 20_000
const SCENARIO_TIMEOUT_MS = 60_000
const GIFT_WRAP_KIND = 1059
const ZAPSTORE_KINDS = [32_267, 30_063, 3063, 24_242]

function nowSec() {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function chatIdentity(identity: TestIdentity, relays: string[]): ChatIdentity {
  return { npub: identity.npub, nsec: identity.nsec, relays }
}

/** The agent's side: kind 14 rumors addressed to it, opened with its key. */
function rumorsFor(relay: TestRelay, agent: TestIdentity) {
  return relay
    .events()
    .filter(
      (event) =>
        event.kind === GIFT_WRAP_KIND &&
        event.tags.some((tag) => tag[0] === 'p' && tag[1] === agent.pubkey)
    )
    .map((wrap) => nip59.unwrapEvent(wrap, agent.secretKey))
}

function responsesIn(rumor: { tags: string[][] }) {
  return rumor.tags
    .filter((tag) => tag[0] === 'sign_response')
    .map((tag) => JSON.parse(tag[1] ?? '{}'))
}

describe('signing requests over a chat session', () => {
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

  /** The user opens a session with the agent and writes in it. */
  async function openSession(user: TestIdentity, agent: TestIdentity) {
    const session = startChatSession(user.npub, agent.pubkey, 'Release')
    await sendNip17Chat(
      new NostrAPI([relay().url]),
      chatIdentity(user, [relay().url]),
      agent.npub,
      'publish 1.4 to Zapstore',
      { sessionId: session.sessionId }
    )
    return session.sessionId
  }

  async function agentAsks(
    agent: TestIdentity,
    user: TestIdentity,
    sessionId: string,
    requests: Record<string, unknown>[]
  ) {
    await sendNip17Chat(
      new NostrAPI([relay().url]),
      chatIdentity(agent, [relay().url]),
      user.npub,
      `Please sign ${requests.length} events`,
      {
        extraTags: requests.map((request) => [
          'sign_request',
          JSON.stringify(request)
        ]),
        sessionId
      }
    )
  }

  function zapstoreBatch(user: TestIdentity) {
    const createdAt = nowSec()
    return ZAPSTORE_KINDS.map((kind, index) => ({
      id: `req-${index}`,
      label: 'Satsigner 1.4',
      method: 'sign_event',
      params: [
        JSON.stringify({ content: '', created_at: createdAt, kind, tags: [] })
      ],
      pubkey: user.pubkey
    }))
  }

  async function receiveBatch(user: TestIdentity, expected: number) {
    const lease = acquireChatPipeline(chatIdentity(user, [relay().url]))
    await lease.ready
    await waitFor(() => getChatPipelineStatus(user.npub).state === 'live', {
      label: 'pipeline live',
      timeoutMs: WAIT_MS
    })
    await waitFor(() => findBatchId(user) !== null, {
      label: 'sign requests queued',
      timeoutMs: WAIT_MS
    })
    lease.release()
    const messageId = findBatchId(user) ?? ''
    expect(listSignRequestBatch(user.npub, messageId)).toHaveLength(expected)
    return messageId
  }

  function findBatchId(user: TestIdentity): string | null {
    const rumorIds = relay()
      .events()
      .filter((event) => event.kind === GIFT_WRAP_KIND)
      .flatMap((wrap) => {
        try {
          return [nip59.unwrapEvent(wrap, user.secretKey).id]
        } catch {
          return []
        }
      })
    return (
      rumorIds.find((id) => listSignRequestBatch(user.npub, id).length > 0) ??
      null
    )
  }

  it(
    'signs a Zapstore batch later, with the chat key, and answers in the session',
    async () => {
      const user = createTestIdentity()
      const agent = createTestIdentity()
      const sessionId = await openSession(user, agent)
      await agentAsks(agent, user, sessionId, zapstoreBatch(user))

      const messageId = await receiveBatch(user, ZAPSTORE_KINDS.length)
      // The app was closed and reopened before the user decided.
      closeActiveChatPipeline()

      const outcome = await approveChatSignRequests(
        new NostrAPI([relay().url]),
        chatIdentity(user, [relay().url]),
        messageId
      )

      expect(outcome).toBe('answered')
      await waitFor(
        () => rumorsFor(relay(), agent).some((r) => responsesIn(r).length > 0),
        { label: 'answer delivered', timeoutMs: WAIT_MS }
      )
      const answer = rumorsFor(relay(), agent).find(
        (rumor) => responsesIn(rumor).length > 0
      )
      expect(answer?.tags).toContainEqual(['session', sessionId])
      expect(answer?.tags).toContainEqual(['e', messageId, '', 'reply'])
      const signed = responsesIn(answer ?? { tags: [] }).map((response) =>
        parseNostrEvent(JSON.parse(response.result))
      )
      expect(signed.map((event) => event?.kind)).toStrictEqual(ZAPSTORE_KINDS)
      for (const event of signed) {
        expect(event && verifyEvent(event)).toBe(true)
        expect(event?.pubkey).toBe(user.pubkey)
      }

      // A second approval of the same batch signs nothing new.
      await expect(
        approveChatSignRequests(
          new NostrAPI([relay().url]),
          chatIdentity(user, [relay().url]),
          messageId
        )
      ).resolves.toBe('skipped')
    },
    SCENARIO_TIMEOUT_MS
  )

  it(
    'refuses a request for another key and declines with the reason',
    async () => {
      const user = createTestIdentity()
      const agent = createTestIdentity()
      const other = createTestIdentity()
      const sessionId = await openSession(user, agent)
      await agentAsks(agent, user, sessionId, [
        {
          id: 'other-key',
          method: 'sign_event',
          params: [
            JSON.stringify({
              content: '',
              created_at: nowSec(),
              kind: 1,
              tags: []
            })
          ],
          pubkey: other.pubkey
        }
      ])

      const messageId = await receiveBatch(user, 1)
      expect(listSignRequestBatch(user.npub, messageId)).toMatchObject([
        { error: 'wrong key', status: 'invalid' }
      ])

      await rejectChatSignRequests(
        new NostrAPI([relay().url]),
        chatIdentity(user, [relay().url]),
        messageId
      )

      await waitFor(
        () => rumorsFor(relay(), agent).some((r) => responsesIn(r).length > 0),
        { label: 'decline delivered', timeoutMs: WAIT_MS }
      )
      const answer = rumorsFor(relay(), agent).find(
        (rumor) => responsesIn(rumor).length > 0
      )
      expect(responsesIn(answer ?? { tags: [] })).toStrictEqual([
        { error: 'wrong key', id: 'other-key' }
      ])
    },
    SCENARIO_TIMEOUT_MS
  )

  it(
    'ignores sign requests from a peer the user never wrote to in that session',
    async () => {
      const user = createTestIdentity()
      const stranger = createTestIdentity()
      await agentAsks(stranger, user, '', zapstoreBatch(user))
      const lease = acquireChatPipeline(chatIdentity(user, [relay().url]))
      await lease.ready
      await waitFor(() => getChatPipelineStatus(user.npub).state === 'live', {
        label: 'pipeline live',
        timeoutMs: WAIT_MS
      })
      await new Promise((resolve) => {
        setTimeout(resolve, 1000)
      })
      lease.release()

      expect(findBatchId(user)).toBeNull()
    },
    SCENARIO_TIMEOUT_MS
  )
})
