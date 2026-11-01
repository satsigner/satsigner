import { NostrAPI } from '@/api/nostr'
import { applyNostrProofOfWork, countLeadingZeroBits } from '@/utils/nostrPow'

import { createTestIdentity } from './support/identities'

const POW_DIFFICULTY = 8

describe('note proof-of-work', () => {
  it('survives the tags ndk adds for hashtags and mentions', async () => {
    const author = createTestIdentity()
    const mentioned = createTestIdentity()

    const prepared = await applyNostrProofOfWork({
      content: `gm #bitcoin @${mentioned.npub}`,
      difficulty: POW_DIFFICULTY,
      nsec: author.nsec,
      tags: []
    })
    const signed = await NostrAPI.signKind1Note(
      author.nsec,
      prepared.content,
      prepared.tags,
      prepared.createdAt
    )

    expect(signed.tags).toContainEqual(['t', 'bitcoin'])
    expect(signed.tags).toContainEqual(['p', mentioned.pubkey])
    expect(countLeadingZeroBits(signed.id)).toBeGreaterThanOrEqual(
      POW_DIFFICULTY
    )
  })
})
