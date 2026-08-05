import {
  getExplorerExampleAddress,
  getExplorerExampleBlock,
  getExplorerExampleTransaction
} from '@/constants/explorerExamples'

describe('getExplorerExampleBlock', () => {
  it('returns the genesis example for height 0', () => {
    expect(getExplorerExampleBlock(0)?.label).toBe('Genesis')
  })

  it('returns the pizza day example for height 57043', () => {
    expect(getExplorerExampleBlock(57043)?.label).toBe('Pizza Day')
  })

  it('accepts string heights', () => {
    expect(getExplorerExampleBlock('170')?.label).toBe('First Tx')
  })

  it('returns undefined for unknown or invalid heights', () => {
    expect(getExplorerExampleBlock(123)).toBeUndefined()
    expect(getExplorerExampleBlock(-1)).toBeUndefined()
    expect(getExplorerExampleBlock('abc')).toBeUndefined()
    expect(getExplorerExampleBlock(null)).toBeUndefined()
    expect(getExplorerExampleBlock(undefined)).toBeUndefined()
  })
})

describe('getExplorerExampleTransaction', () => {
  it('looks up by txid case-insensitively', () => {
    const txid =
      'F4184FC596403B9D638783CF57ADFE4C75C605F6356FBC91338530E9831E9E16'
    expect(getExplorerExampleTransaction(txid)?.label).toBe('First Tx')
  })
})

describe('getExplorerExampleAddress', () => {
  it('looks up the genesis address', () => {
    expect(
      getExplorerExampleAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')?.label
    ).toBe('Genesis')
  })
})
