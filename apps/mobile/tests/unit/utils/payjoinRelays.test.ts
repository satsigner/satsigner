import { PAYJOIN_OHTTP_RELAY_URLS } from '@/constants/payjoin'
import { getShuffledOhttpRelays } from '@/utils/payjoinRelays'

describe('payjoinRelays', () => {
  it('returns all default relays', () => {
    const shuffled = getShuffledOhttpRelays()
    expect(shuffled).toHaveLength(PAYJOIN_OHTTP_RELAY_URLS.length)
    for (const relay of PAYJOIN_OHTTP_RELAY_URLS) {
      expect(shuffled).toContain(relay)
    }
  })

  it('does not mutate the source list', () => {
    const original = [...PAYJOIN_OHTTP_RELAY_URLS]
    getShuffledOhttpRelays()
    expect([...PAYJOIN_OHTTP_RELAY_URLS]).toStrictEqual(original)
  })
})
