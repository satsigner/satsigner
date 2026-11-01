import { finalizeEvent } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import { fetchNoteEngagementCoalesced } from '@/api/nostrEngagementFetcher'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import { summarizeNoteEngagement } from '@/utils/nostrEngagement'

import { createTestIdentity, type TestIdentity } from './support/identities'
import { resetNodeNitroSqlite } from './support/nodeNitroSqlite'
import { startTestRelay, type TestRelay } from './support/testRelay'

const NOW_SEC = Math.floor(Date.now() / 1000)

function signedNote(author: TestIdentity, content = 'like me') {
  return finalizeEvent(
    {
      content,
      created_at: NOW_SEC - 60,
      kind: nostrKinds.ShortTextNote,
      tags: []
    },
    author.secretKey
  )
}

function signedLike(reactor: TestIdentity, noteId: string, author: string) {
  return finalizeEvent(
    {
      content: '+',
      created_at: NOW_SEC - 30,
      kind: nostrKinds.Reaction,
      tags: [
        ['e', noteId],
        ['p', author]
      ]
    },
    reactor.secretKey
  )
}

function signedDeletion(author: TestIdentity, eventId: string) {
  return finalizeEvent(
    {
      content: '',
      created_at: NOW_SEC - 10,
      kind: nostrKinds.EventDeletion,
      tags: [['e', eventId]]
    },
    author.secretKey
  )
}

describe('note engagement against a real relay', () => {
  const state: { relay?: TestRelay } = {}

  function relay(): TestRelay {
    if (!state.relay) {
      throw new Error('relay not started')
    }
    return state.relay
  }

  async function engagementOf(noteId: string, ownPubkey: string) {
    const api = new NostrAPI([relay().url])
    const events = await api.fetchEngagement([noteId], ownPubkey)
    api.disconnect()
    return summarizeNoteEngagement(events, ownPubkey)
  }

  beforeEach(async () => {
    resetNodeNitroSqlite()
    resetRelayHealth()
    state.relay = await startTestRelay()
  })

  afterEach(async () => {
    clearNdkRegistry()
    await state.relay?.stop()
  })

  it('publishes a like, counts it and removes it again on unlike', async () => {
    const author = createTestIdentity()
    const me = createTestIdentity()
    const other = createTestIdentity()
    const note = signedNote(author)
    relay().seed([note, signedLike(other, note.id, author.pubkey)])
    const api = new NostrAPI([relay().url])

    const like = await api.publishReaction(me.nsec, note)
    const liked = await engagementOf(note.id, me.pubkey)
    expect(liked.likeCount).toBe(2)
    expect(liked.ownLikeIds).toStrictEqual([like.id])

    await api.requestDeletion(liked.ownLikeIds, me.nsec)
    api.disconnect()

    const unliked = await engagementOf(note.id, me.pubkey)
    expect(unliked.likeCount).toBe(1)
    expect(unliked.ownLikeIds).toStrictEqual([])
  }, 30_000)

  it('reposts a note as kind 6 and undoes it', async () => {
    const author = createTestIdentity()
    const me = createTestIdentity()
    const note = signedNote(author)
    relay().seed([note])
    const api = new NostrAPI([relay().url])

    const repost = await api.publishRepost(me.nsec, note)
    expect(repost.kind).toBe(nostrKinds.Repost)
    const reposted = await engagementOf(note.id, me.pubkey)
    expect(reposted.repostCount).toBe(1)
    expect(reposted.ownRepostIds).toStrictEqual([repost.id])

    await api.requestDeletion(reposted.ownRepostIds, me.nsec)
    api.disconnect()

    const undone = await engagementOf(note.id, me.pubkey)
    expect(undone.repostCount).toBe(0)
  }, 30_000)

  it('loads a window of notes with one engagement REQ', async () => {
    const author = createTestIdentity()
    const fan = createTestIdentity()
    const notes = [signedNote(author, 'one'), signedNote(author, 'two')]
    relay().seed([
      ...notes,
      ...notes.map((note) => signedLike(fan, note.id, author.pubkey))
    ])
    const reqsBefore = relay().reqLog().length

    const results = await Promise.all(
      notes.map((note) =>
        fetchNoteEngagementCoalesced(note.id, [relay().url], fan.pubkey)
      )
    )

    expect(results.map((events) => events.length)).toStrictEqual([1, 1])
    const engagementReqs = relay()
      .reqLog()
      .slice(reqsBefore)
      .filter((entry) =>
        entry.filters.some((filter) =>
          filter.kinds?.includes(nostrKinds.Reaction)
        )
      )
    expect(engagementReqs).toHaveLength(1)
  }, 30_000)

  it('ignores deletions that someone else signed', async () => {
    const author = createTestIdentity()
    const fan = createTestIdentity()
    const note = signedNote(author)
    const like = signedLike(fan, note.id, author.pubkey)
    relay().seed([note, like, signedDeletion(author, like.id)])

    const summary = await engagementOf(note.id, author.pubkey)

    expect(summary.likeCount).toBe(1)
  }, 30_000)
})
