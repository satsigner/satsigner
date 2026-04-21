import {
  formatLndChainsForUi,
  getLndFundingTxMempoolUrl,
  lndChainsExplorerNetworkHint
} from '@/utils/lndGetInfoChains'

describe('lndGetInfoChains', () => {
  describe('lndChainsExplorerNetworkHint', () => {
    it('should combine chain and network from LND getinfo shape', () => {
      expect(
        lndChainsExplorerNetworkHint([{ chain: 'bitcoin', network: 'mainnet' }])
      ).toBe('bitcoin mainnet')
    })

    it('should lowercase legacy string entry', () => {
      expect(lndChainsExplorerNetworkHint(['bitcoin'])).toBe('bitcoin')
    })

    it('should return empty string for empty or missing chains', () => {
      expect(lndChainsExplorerNetworkHint(undefined)).toBe('')
      expect(lndChainsExplorerNetworkHint([])).toBe('')
    })
  })

  describe('formatLndChainsForUi', () => {
    it('should format object entries as chain/network', () => {
      expect(
        formatLndChainsForUi([
          { chain: 'bitcoin', network: 'testnet' },
          { chain: 'bitcoin', network: 'mainnet' }
        ])
      ).toBe('bitcoin/testnet, bitcoin/mainnet')
    })

    it('should return empty string when absent', () => {
      expect(formatLndChainsForUi(undefined)).toBe('')
    })
  })

  describe('getLndFundingTxMempoolUrl', () => {
    const txid = 'a'.repeat(64)

    it('should return mainnet mempool URL by default', () => {
      expect(
        getLndFundingTxMempoolUrl(txid, [
          { chain: 'bitcoin', network: 'mainnet' }
        ])
      ).toBe(`https://mempool.space/tx/${txid}`)
    })

    it('should return testnet URL when network hints testnet', () => {
      expect(
        getLndFundingTxMempoolUrl(txid, [
          { chain: 'bitcoin', network: 'testnet' }
        ])
      ).toBe(`https://mempool.space/testnet/tx/${txid}`)
    })

    it('should return null for regtest', () => {
      expect(
        getLndFundingTxMempoolUrl(txid, [
          { chain: 'bitcoin', network: 'regtest' }
        ])
      ).toBeNull()
    })

    it('should return null for blank txid', () => {
      expect(getLndFundingTxMempoolUrl('  ', undefined)).toBeNull()
    })
  })
})
