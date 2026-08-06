import {
  clearNostrFollowCaches,
  getNostrFollowCache,
  mmkvStorage,
  setNostrFollowCache
} from '@/storage/mmkv'

describe('mmkv storage - clearNostrFollowCaches', () => {
  it('removes only nostr follow cache keys and leaves other keys intact', () => {
    setNostrFollowCache('npub1a', ['pubkey1', 'pubkey2'])
    setNostrFollowCache('npub1b', ['pubkey3'])
    mmkvStorage.setItem('satsigner-blockchain', '{"selectedNetwork":"signet"}')

    clearNostrFollowCaches()

    expect(getNostrFollowCache('npub1a')).toBeNull()
    expect(getNostrFollowCache('npub1b')).toBeNull()
    expect(mmkvStorage.getItem('satsigner-blockchain')).toBe(
      '{"selectedNetwork":"signet"}'
    )
  })
})
