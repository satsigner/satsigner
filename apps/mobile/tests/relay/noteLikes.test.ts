import { finalizeEvent } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import { summarizeNoteLikes } from '@/utils/nostrReactions'

import { createTestIdentity, type TestIdentity } from './support/identities'
import { resetNodeNitroSqlite } from './support/nodeNitroSqlite'
import { startTestRelay, type TestRelay } from './support/testRelay'

const NOW_SEC = Math.floor(Date.now() / 1000)

function signedNote(author: TestIdentity) {
  return finalizeEvent(
    {
      content: 'like me',
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

describe('note likes against a real relay', () => {
  const state: { relay?: TestRelay } = {}

  function relay(): TestRelay {
    if (!state.relay) {
      throw new Error('relay not started')
    }
    return state.relay
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

    const reaction = await api.publishReaction(me.nsec, note)

    expect(reaction.content).toBe('+')
    const liked = summarizeNoteLikes(
      await api.fetchReactions(note.id),
      me.pubkey
    )
    expect(liked).toStrictEqual({ count: 2, ownLikeIds: [reaction.id] })

    await api.requestDeletion(liked.ownLikeIds, me.nsec)

    const unliked = summarizeNoteLikes(
      await api.fetchReactions(note.id),
      me.pubkey
    )
    expect(unliked).toStrictEqual({ count: 1, ownLikeIds: [] })
    api.disconnect()
  }, 30_000)

  it('ignores deletions that someone else signed', async () => {
    const author = createTestIdentity()
    const fan = createTestIdentity()
    const note = signedNote(author)
    const like = signedLike(fan, note.id, author.pubkey)
    relay().seed([note, like, signedDeletion(author, like.id)])

    const reactions = await new NostrAPI([relay().url]).fetchReactions(note.id)

    expect(reactions.map((item) => item.id)).toStrictEqual([like.id])
  }, 30_000)
})
