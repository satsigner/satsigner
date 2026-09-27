import { type NostrDecodedContent } from '@/types/models/Nostr'
import {
  getDecodedContentRelays,
  getDecodedContentTags
} from '@/utils/nostrDecodedContent'

function decodedContent(
  metadata?: Record<string, unknown>
): NostrDecodedContent {
  return { data: '', kind: 'json_note', metadata, raw: '' }
}

describe('getDecodedContentTags', () => {
  it('returns well-formed tags as they are', () => {
    const tags = [
      ['amount', '21000'],
      ['p', 'abc', 'wss://relay.example.com']
    ]
    expect(getDecodedContentTags(decodedContent({ tags }))).toStrictEqual(tags)
  })

  it('drops tags that are not string arrays', () => {
    const tags = [['e', 'id'], ['e', 1], 'p', null, { 0: 't' }, ['t', 'nostr']]
    expect(getDecodedContentTags(decodedContent({ tags }))).toStrictEqual([
      ['e', 'id'],
      ['t', 'nostr']
    ])
  })

  it('returns no tags when metadata has no tag list', () => {
    expect(getDecodedContentTags(decodedContent())).toStrictEqual([])
    expect(getDecodedContentTags(decodedContent({}))).toStrictEqual([])
    expect(
      getDecodedContentTags(decodedContent({ tags: 'p,abc' }))
    ).toStrictEqual([])
  })
})

describe('getDecodedContentRelays', () => {
  it('returns the relay hints', () => {
    const relays = ['wss://relay.damus.io', 'wss://nos.lol']
    expect(getDecodedContentRelays(decodedContent({ relays }))).toStrictEqual(
      relays
    )
  })

  it('drops relay hints that are not strings', () => {
    const relays = ['wss://relay.damus.io', 7, null]
    expect(getDecodedContentRelays(decodedContent({ relays }))).toStrictEqual([
      'wss://relay.damus.io'
    ])
  })

  it('returns undefined when there is no usable relay hint', () => {
    expect(getDecodedContentRelays(decodedContent())).toBeUndefined()
    expect(
      getDecodedContentRelays(decodedContent({ relays: undefined }))
    ).toBeUndefined()
    expect(
      getDecodedContentRelays(decodedContent({ relays: [] }))
    ).toBeUndefined()
    expect(
      getDecodedContentRelays(decodedContent({ relays: [42] }))
    ).toBeUndefined()
    expect(
      getDecodedContentRelays(decodedContent({ relays: 'wss://nos.lol' }))
    ).toBeUndefined()
  })
})
