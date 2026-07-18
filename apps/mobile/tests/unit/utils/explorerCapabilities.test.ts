import {
  canViewBlockTransactions,
  formatExplorerBackendSource,
  getExplorerCapability
} from '@/utils/explorerCapabilities'

describe('explorerCapabilities', () => {
  describe('getExplorerCapability', () => {
    it('marks block tx list available for esplora and rpc', () => {
      expect(getExplorerCapability('esplora', 'blockTxList').available).toBe(
        true
      )
      expect(getExplorerCapability('rpc', 'blockTxList').available).toBe(true)
    })

    it('marks block tx list unavailable for electrum with why/fix keys', () => {
      const result = getExplorerCapability('electrum', 'blockTxList')
      expect(result.available).toBe(false)
      expect(result.whyKey).toBe('explorer.capability.blockTxList.electrum.why')
      expect(result.fixKey).toBe('explorer.capability.blockTxList.electrum.fix')
    })

    it('marks address history unavailable for rpc', () => {
      const result = getExplorerCapability('rpc', 'addressHistory')
      expect(result.available).toBe(false)
      expect(result.whyKey).toContain('addressHistory.rpc.why')
    })

    it('marks difficulty adjustment unavailable for all backends', () => {
      expect(
        getExplorerCapability('electrum', 'difficultyAdjustment').available
      ).toBe(false)
      expect(
        getExplorerCapability('esplora', 'difficultyAdjustment').available
      ).toBe(false)
      expect(
        getExplorerCapability('rpc', 'difficultyAdjustment').available
      ).toBe(false)
    })

    it('marks raw block available for esplora and rpc', () => {
      expect(getExplorerCapability('esplora', 'rawBlock').available).toBe(true)
      expect(getExplorerCapability('rpc', 'rawBlock').available).toBe(true)
    })

    it('marks raw block unavailable for electrum with why/fix keys', () => {
      const result = getExplorerCapability('electrum', 'rawBlock')
      expect(result.available).toBe(false)
      expect(result.whyKey).toBe('explorer.capability.rawBlock.electrum.why')
      expect(result.fixKey).toBe('explorer.capability.rawBlock.electrum.fix')
    })
  })

  describe('canViewBlockTransactions', () => {
    it('allows esplora and rpc only', () => {
      expect(canViewBlockTransactions('esplora')).toBe(true)
      expect(canViewBlockTransactions('rpc')).toBe(true)
      expect(canViewBlockTransactions('electrum')).toBe(false)
    })
  })

  describe('formatExplorerBackendSource', () => {
    it('formats name and backend', () => {
      expect(formatExplorerBackendSource('My Node', 'rpc')).toBe(
        'My Node (rpc)'
      )
    })
  })
})
