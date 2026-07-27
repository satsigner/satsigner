import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/outpoint'
import {
  applyUtxoDenylist,
  filterUtxos,
  groupUtxos,
  isUtxoExcluded,
  prepareUtxoList,
  pruneExcludedOutpoints,
  sortUtxosByField
} from '@/utils/utxoList'

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

describe('utxoList', () => {
  const utxos = [
    makeUtxo({
      addressTo: 'tb1qa',
      keychain: 'external',
      label: 'payjoin #shared #alpha',
      timestamp: new Date('2026-01-03T00:00:00.000Z'),
      txid: 'a',
      value: 3000,
      vout: 0
    }),
    makeUtxo({
      addressTo: 'tb1qb',
      keychain: 'internal',
      label: '',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      txid: 'b',
      value: 1000,
      vout: 0
    }),
    makeUtxo({
      addressTo: 'tb1qa',
      keychain: 'external',
      label: 'alpha #alpha',
      timestamp: new Date('2026-01-02T00:00:00.000Z'),
      txid: 'c',
      value: 2000,
      vout: 1
    })
  ]

  describe('sortUtxosByField', () => {
    it('sorts by amount descending and ascending', () => {
      const desc = sortUtxosByField(utxos, 'amount', 'desc')
      expect(desc.map((u) => u.value)).toStrictEqual([3000, 2000, 1000])

      const asc = sortUtxosByField(utxos, 'amount', 'asc')
      expect(asc.map((u) => u.value)).toStrictEqual([1000, 2000, 3000])
    })

    it('sorts by date with field independent of direction', () => {
      const desc = sortUtxosByField(utxos, 'date', 'desc')
      expect(desc.map((u) => u.txid)).toStrictEqual(['a', 'c', 'b'])

      const asc = sortUtxosByField(utxos, 'date', 'asc')
      expect(asc.map((u) => u.txid)).toStrictEqual(['b', 'c', 'a'])
    })

    it('sorts by label and puts empty labels last', () => {
      const asc = sortUtxosByField(utxos, 'label', 'asc')
      expect(asc.map((u) => u.txid)).toStrictEqual(['c', 'a', 'b'])
    })
  })

  describe('filterUtxos', () => {
    it('filters by keychain and label text (ignoring tag-only labels)', () => {
      const receive = filterUtxos(utxos, {
        keychain: 'external',
        label: 'all'
      })
      expect(receive).toHaveLength(2)

      const labeled = filterUtxos(utxos, {
        keychain: 'all',
        label: 'labeled'
      })
      expect(labeled.map((u) => u.txid).toSorted()).toStrictEqual(['a', 'c'])

      const unlabeled = filterUtxos(utxos, {
        keychain: 'internal',
        label: 'unlabeled'
      })
      expect(unlabeled.map((u) => u.txid)).toStrictEqual(['b'])

      const tagOnly = makeUtxo({
        label: '#solo',
        txid: 'd',
        vout: 0
      })
      expect(
        filterUtxos([tagOnly], { keychain: 'all', label: 'labeled' })
      ).toHaveLength(0)
      expect(
        filterUtxos([tagOnly], { keychain: 'all', label: 'unlabeled' })
      ).toHaveLength(1)
    })
  })

  describe('groupUtxos', () => {
    it('returns a single flat group for none', () => {
      const groups = groupUtxos(utxos, 'none')
      expect(groups).toHaveLength(1)
      expect(groups[0].utxos).toHaveLength(3)
    })

    it('groups by address, label, tag, and keychain', () => {
      expect(groupUtxos(utxos, 'address')).toHaveLength(2)
      expect(groupUtxos(utxos, 'label')).toHaveLength(3)
      expect(groupUtxos(utxos, 'keychain')).toHaveLength(2)

      const byTag = groupUtxos(utxos, 'tag')
      expect(byTag.map((g) => g.key).toSorted()).toStrictEqual([
        'tag:',
        'tag:alpha',
        'tag:shared'
      ])
      // Multi-tag UTXOs appear once under the first tag in label order.
      expect(
        byTag.find((g) => g.key === 'tag:shared')?.utxos.map((u) => u.txid)
      ).toStrictEqual(['a'])
      expect(
        byTag.find((g) => g.key === 'tag:alpha')?.utxos.map((u) => u.txid)
      ).toStrictEqual(['c'])
      expect(
        byTag.find((g) => g.key === 'tag:')?.utxos.map((u) => u.txid)
      ).toStrictEqual(['b'])
    })
  })

  describe('denylist helpers', () => {
    it('applies and checks excluded outpoints', () => {
      const outpoint = getUtxoOutpoint(utxos[0])
      expect(isUtxoExcluded(utxos[0], [outpoint])).toBe(true)
      expect(applyUtxoDenylist(utxos, [outpoint])).toHaveLength(2)
    })

    it('prunes spent outpoints from the denylist', () => {
      const live = getUtxoOutpoint(utxos[1])
      const pruned = pruneExcludedOutpoints([live, 'dead:txid:9'], utxos)
      expect(pruned).toStrictEqual([live])
    })
  })

  describe('prepareUtxoList', () => {
    it('runs denylist, filter, group, then sort', () => {
      const excluded = [getUtxoOutpoint(utxos[1])]
      const groups = prepareUtxoList({
        excludedOutpoints: excluded,
        filter: { keychain: 'external', label: 'all' },
        groupMode: 'address',
        sortDirection: 'asc',
        sortField: 'amount',
        utxos
      })

      expect(groups).toHaveLength(1)
      expect(groups[0].key).toBe('tb1qa')
      expect(groups[0].utxos.map((u) => u.value)).toStrictEqual([2000, 3000])
    })

    it('keeps excluded UTXOs when hideExcluded is false', () => {
      const excluded = [getUtxoOutpoint(utxos[0])]
      const groups = prepareUtxoList({
        excludedOutpoints: excluded,
        hideExcluded: false,
        sortField: 'amount',
        utxos
      })

      expect(groups[0].utxos).toHaveLength(3)
    })
  })
})
