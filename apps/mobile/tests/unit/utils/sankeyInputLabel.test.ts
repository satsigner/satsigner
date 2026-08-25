import {
  buildOutpointLabelsByRef,
  buildSpendingTxIdsByOutpoint,
  resolveSankeyInputLabel
} from '@/utils/sankeyInputLabel'

describe('resolveSankeyInputLabel', () => {
  it('prefers previous transaction label', () => {
    expect(
      resolveSankeyInputLabel(
        'prev-tx',
        0,
        { 'prev-tx': 'funding' },
        { 'prev-tx:0': 'coin' }
      )
    ).toBe('funding')
  })

  it('falls back to consumed outpoint label', () => {
    expect(
      resolveSankeyInputLabel('prev-tx', 1, undefined, {
        'prev-tx:1': 'my utxo'
      })
    ).toBe('my utxo')
  })

  it('returns empty when neither label exists', () => {
    expect(resolveSankeyInputLabel('prev-tx', 0)).toBe('')
  })
})

describe('buildOutpointLabelsByRef', () => {
  it('uses account.labels and utxos, skips synthetic output inherit labels', () => {
    const labels = buildOutpointLabelsByRef({
      labels: {
        'abc:2': { label: 'explicit' },
        txidOnly: { label: 'ignored-tx-ref' }
      },
      transactions: [
        {
          id: 'parent',
          label: 'send',
          vout: [{ label: 'send (output 0)' }, { label: 'real change label' }]
        }
      ],
      utxos: [{ label: 'from-utxo', txid: 'u1', vout: 0 }]
    })

    expect(labels.get('abc:2')).toBe('explicit')
    expect(labels.get('u1:0')).toBe('from-utxo')
    expect(labels.get('parent:0')).toBeUndefined()
    expect(labels.get('parent:1')).toBe('real change label')
    expect(labels.has('txidOnly')).toBe(false)
  })
})

describe('buildSpendingTxIdsByOutpoint', () => {
  it('maps spent outpoints to the consuming transaction id', () => {
    const spendingTxIds = buildSpendingTxIdsByOutpoint([
      {
        id: 'spend-a',
        vin: [{ previousOutput: { txid: 'parent', vout: 0 } }]
      },
      {
        id: 'spend-b',
        vin: [
          { previousOutput: { txid: 'parent', vout: 1 } },
          { previousOutput: { txid: 'other', vout: 2 } }
        ]
      }
    ])

    expect(spendingTxIds.get('parent:0')).toBe('spend-a')
    expect(spendingTxIds.get('parent:1')).toBe('spend-b')
    expect(spendingTxIds.get('other:2')).toBe('spend-b')
  })

  it('keeps the first spending tx when an outpoint appears twice', () => {
    const spendingTxIds = buildSpendingTxIdsByOutpoint([
      {
        id: 'first',
        vin: [{ previousOutput: { txid: 'parent', vout: 0 } }]
      },
      {
        id: 'second',
        vin: [{ previousOutput: { txid: 'parent', vout: 0 } }]
      }
    ])

    expect(spendingTxIds.get('parent:0')).toBe('first')
  })
})
