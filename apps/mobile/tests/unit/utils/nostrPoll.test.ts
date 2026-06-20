import {
  extractPollInfo,
  extractResponseOptionIds,
  getUserPollVoteOptionIds,
  isPollExpired,
  resolvePollVoteOptionIds,
  tallyPollVotes,
  type NostrPollResponse
} from '@/utils/nostrPoll'

describe('extractPollInfo', () => {
  it('parses poll options and metadata from tags', () => {
    const info = extractPollInfo([
      ['option', 'abc123', 'Yes'],
      ['option', 'def456', 'No'],
      ['relay', 'wss://relay.example.com'],
      ['polltype', 'multiplechoice'],
      ['endsAt', '1719888496']
    ])

    expect(info).toStrictEqual({
      endsAt: 1719888496,
      options: [
        { id: 'abc123', label: 'Yes' },
        { id: 'def456', label: 'No' }
      ],
      pollType: 'multiplechoice',
      relays: ['wss://relay.example.com']
    })
  })

  it('defaults to single choice when polltype is missing', () => {
    const info = extractPollInfo([['option', 'abc123', 'Yes']])

    expect(info?.pollType).toBe('singlechoice')
  })
})

describe('poll vote helpers', () => {
  const responses: NostrPollResponse[] = [
    {
      created_at: 10,
      id: 'a',
      optionIds: ['yes', 'no'],
      pubkey: 'pk1'
    },
    {
      created_at: 20,
      id: 'b',
      optionIds: ['no'],
      pubkey: 'pk1'
    },
    {
      created_at: 15,
      id: 'c',
      optionIds: ['yes'],
      pubkey: 'pk2'
    }
  ]

  it('resolves single-choice votes to the first response tag', () => {
    expect(resolvePollVoteOptionIds(['no', 'yes'], 'singlechoice')).toStrictEqual([
      'no'
    ])
  })

  it('deduplicates multiple-choice votes', () => {
    expect(
      resolvePollVoteOptionIds(['yes', 'yes', 'no'], 'multiplechoice')
    ).toStrictEqual(['yes', 'no'])
  })

  it('uses the latest response per pubkey when tallying votes', () => {
    expect(tallyPollVotes(responses, 'singlechoice')).toStrictEqual(
      new Map([
        ['no', 1],
        ['yes', 1]
      ])
    )
  })

  it('returns the latest vote for the current user', () => {
    expect(getUserPollVoteOptionIds(responses, 'pk1', 'singlechoice')).toStrictEqual([
      'no'
    ])
  })

  it('detects expired polls', () => {
    expect(isPollExpired(100, 100)).toBe(true)
    expect(isPollExpired(101, 100)).toBe(false)
    expect(isPollExpired(undefined, 100)).toBe(false)
  })

  it('extracts response option ids from tags', () => {
    expect(
      extractResponseOptionIds([
        ['e', 'poll-id'],
        ['response', 'yes'],
        ['response', 'no']
      ])
    ).toStrictEqual(['yes', 'no'])
  })
})
