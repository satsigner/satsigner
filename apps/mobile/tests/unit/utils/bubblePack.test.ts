import { type Utxo } from '@/types/models/Utxo'
import { buildBubblePackRoot } from '@/utils/bubblePack'

function makeUtxo(
  overrides: Partial<Utxo> & Pick<Utxo, 'txid' | 'vout'>
): Utxo {
  return {
    addressTo: 'tb1qabc',
    keychain: 'external',
    label: '',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    value: 1000,
    ...overrides
  }
}

describe('bubblePack', () => {
  const utxos = [
    makeUtxo({
      addressTo: 'tb1qa',
      keychain: 'external',
      label: 'pay #alpha',
      txid: 'a',
      value: 3000,
      vout: 0
    }),
    makeUtxo({
      addressTo: 'tb1qb',
      keychain: 'internal',
      txid: 'b',
      value: 1000,
      vout: 0
    }),
    makeUtxo({
      addressTo: 'tb1qa',
      keychain: 'external',
      label: 'other #beta',
      txid: 'c',
      value: 2000,
      vout: 1
    })
  ]

  it('builds a flat root when group mode is none', () => {
    const root = buildBubblePackRoot(utxos, 'none')
    expect(root.children).toHaveLength(3)
    expect(root.children.every((child) => child.utxo)).toBe(true)
  })

  it('nests UTXOs under group nodes for keychain and tag', () => {
    const byKeychain = buildBubblePackRoot(utxos, 'keychain')
    expect(byKeychain.children.map((g) => g.id).toSorted()).toStrictEqual([
      'group:external',
      'group:internal'
    ])
    expect(
      byKeychain.children.find((g) => g.id === 'group:external')?.children
    ).toHaveLength(2)

    const byTag = buildBubblePackRoot(utxos, 'tag')
    expect(byTag.children.map((g) => g.id).toSorted()).toStrictEqual([
      'group:tag:',
      'group:tag:alpha',
      'group:tag:beta'
    ])
    expect(byTag.children.every((g) => Boolean(g.title))).toBe(true)
  })
})
