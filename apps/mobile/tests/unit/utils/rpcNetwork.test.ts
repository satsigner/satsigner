import { expectedCoreChain, formatChainMismatchError } from '@/utils/rpcNetwork'

describe('rpcNetwork', () => {
  it('maps app networks to Core chain names', () => {
    expect(expectedCoreChain('bitcoin')).toBe('main')
    expect(expectedCoreChain('signet')).toBe('signet')
    expect(expectedCoreChain('testnet')).toBe('test')
  })

  it('formats chain mismatch errors with port hints', () => {
    const message = formatChainMismatchError(
      'signet',
      'main',
      'http://192.168.1.10:8332'
    )
    expect(message).toContain('main')
    expect(message).toContain('signet')
    expect(message).toContain('38332')
  })
})
