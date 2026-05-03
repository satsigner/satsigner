import { getBackPath, showNavigation } from '@/utils/navigation'

describe('navigation utils', () => {
  describe('showNavigation', () => {
    it('returns true for root path', () => {
      expect(showNavigation('/', 0)).toBe(true)
    })

    it('returns false for settings screen', () => {
      expect(showNavigation('/settings', 1)).toBe(false)
    })

    it('returns false when depth exceeds 4', () => {
      expect(showNavigation('/signer/bitcoin/account/123/settings', 5)).toBe(false)
    })
  })

  describe('getBackPath', () => {
    it('returns / for empty or root path', () => {
      expect(getBackPath('')).toBe('/')
      expect(getBackPath('/')).toBe('/')
    })

    describe('simple segment stripping (valid intermediate routes)', () => {
      it('strips last segment for settings sub-pages', () => {
        expect(getBackPath('/settings/security')).toBe('/settings')
        expect(getBackPath('/settings/network/server')).toBe('/settings/network')
      })

      it('strips last segment for lightning node sub-pages', () => {
        expect(getBackPath('/signer/lightning/node/settings')).toBe(
          '/signer/lightning/node'
        )
        expect(getBackPath('/signer/lightning/node')).toBe('/signer/lightning')
      })

      it('strips last segment for nostr create/import sub-pages', () => {
        expect(getBackPath('/signer/nostr/create/profile')).toBe('/signer/nostr/create')
        expect(getBackPath('/signer/nostr/import/index')).toBe('/signer/nostr/import')
      })
    })

    describe('container segment skipping (directories with no index.tsx)', () => {
      it('transaction/[txid] -> account detail', () => {
        expect(getBackPath('/signer/bitcoin/account/123/transaction/abc')).toBe(
          '/signer/bitcoin/account/123'
        )
      })

      it('address/[addr] -> account detail', () => {
        expect(getBackPath('/signer/bitcoin/account/123/address/addr1')).toBe(
          '/signer/bitcoin/account/123'
        )
      })

      it('transaction/[txid]/label -> transaction detail (no container skip needed)', () => {
        expect(getBackPath('/signer/bitcoin/account/123/transaction/abc/label')).toBe(
          '/signer/bitcoin/account/123/transaction/abc'
        )
      })

      it('transaction/[txid]/utxo/[vout] -> transaction detail', () => {
        expect(
          getBackPath('/signer/bitcoin/account/123/transaction/abc/utxo/0')
        ).toBe('/signer/bitcoin/account/123/transaction/abc')
      })

      it('channel/[chanId] -> lightning node', () => {
        expect(getBackPath('/signer/lightning/node/channel/123')).toBe(
          '/signer/lightning/node'
        )
      })

      it('ecash proof/[index] -> ecash account detail', () => {
        expect(getBackPath('/signer/ecash/account/id/proof/0')).toBe(
          '/signer/ecash/account/id'
        )
      })

      it('nostr zap/[zapId] -> nostr account', () => {
        expect(getBackPath('/signer/nostr/account/npub1/zap/zapId')).toBe(
          '/signer/nostr/account/npub1'
        )
      })

      it('nostr contact/[npub] -> nostr account', () => {
        expect(getBackPath('/signer/nostr/account/npub1/contact/npub2')).toBe(
          '/signer/nostr/account/npub1'
        )
      })
    })

    describe('parent path overrides (non-existent intermediate routes)', () => {
      it('bitcoin account/[id] -> accountList', () => {
        expect(getBackPath('/signer/bitcoin/account/123')).toBe(
          '/signer/bitcoin/accountList'
        )
      })

      it('bitcoin accountList -> section landing', () => {
        expect(getBackPath('/signer/bitcoin/accountList')).toBe('/')
      })

      it('ark account/[id] -> ark index', () => {
        expect(getBackPath('/signer/ark/account/abc')).toBe('/signer/ark')
      })

      it('signer top-level pages -> section landing', () => {
        expect(getBackPath('/signer/ark')).toBe('/')
        expect(getBackPath('/signer/lightning')).toBe('/')
        expect(getBackPath('/signer/ecash')).toBe('/')
        expect(getBackPath('/signer/nostr')).toBe('/')
      })

      it('ecash account/[id] -> ecash index', () => {
        expect(getBackPath('/signer/ecash/account/abc')).toBe('/signer/ecash')
      })

      it('nostr account/[npub] -> nostr index', () => {
        expect(getBackPath('/signer/nostr/account/npub1abc')).toBe('/signer/nostr')
      })

      it('explorer pages -> section landing', () => {
        expect(getBackPath('/explorer/difficulty')).toBe('/')
      })

      it('converter pages -> section landing', () => {
        expect(getBackPath('/converter/currency')).toBe('/')
      })
    })
  })
})
