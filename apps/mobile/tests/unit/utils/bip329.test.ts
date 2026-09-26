import { ZodError } from 'zod'

import {
  bip329export,
  bip329parser,
  CSVtoLabels,
  JSONLtoLabels
} from '@/utils/bip329'

const TXID = '659a13373d6fad4adcfc74aa6fd331fe16d783ebb77f89e57edda61a58a85022'

// TODO: rename Nonchunk to Nunchunk
const {
  sampleCsvNonchukTx,
  sampleCsvNonchukTxExpected,
  sampleCsvNonchukUtxo,
  sampleCsvNonchukUtxoExpected,
  sampleCsvSparrowAddr,
  sampleCsvSparrowTx,
  sampleCsvSparrowTxExpected,
  sampleCsvSparrowUtxo,
  sampleCsvSparrowUtxoExpected,
  sampleJsonl,
  sampleJsonlExpected
} = require('./bip329Samples')

describe('jsonl to labels', () => {
  it('parses JSON to labels', () => {
    expect(JSONLtoLabels(sampleJsonl)).toStrictEqual(sampleJsonlExpected)
  })

  it('reads an ISO-8601 time and typed BIP-329 fields', () => {
    const line = JSON.stringify({
      fee: 164,
      height: 776112,
      label: 'Transaction',
      rate: { USD: 23012.12 },
      ref: TXID,
      time: '2023-02-22T20:31:26Z',
      type: 'tx',
      value: -4500000
    })
    expect(JSONLtoLabels(line)).toStrictEqual([
      {
        fee: 164,
        height: 776112,
        label: 'Transaction',
        rate: { USD: 23012.12 },
        ref: TXID,
        time: new Date('2023-02-22T20:31:26Z'),
        type: 'tx',
        value: -4500000
      }
    ])
  })

  it('reads a label sync entry, turning its unix timestamp into a time', () => {
    const line = JSON.stringify({
      VERSION: '0.0.3',
      __class__: 'Label',
      label: 'coffee',
      ref: TXID,
      spendable: false,
      timestamp: 1_700_000_000,
      type: 'tx'
    })
    expect(JSONLtoLabels(line)).toStrictEqual([
      {
        label: 'coffee',
        ref: TXID,
        spendable: false,
        time: new Date(1_700_000_000_000),
        type: 'tx'
      }
    ])
  })

  it('drops optional fields it cannot read and keeps the label', () => {
    const line = JSON.stringify({
      fee: 'abc',
      label: 'coffee',
      rate: 5,
      ref: TXID,
      time: 'yesterday',
      type: 'tx'
    })
    expect(JSONLtoLabels(line)).toStrictEqual([
      { label: 'coffee', ref: TXID, type: 'tx' }
    ])
  })

  it('lets an alias key win over the canonical key', () => {
    const line = JSON.stringify({
      label: 'coffee',
      ref: 'canonical',
      txid: TXID,
      type: 'tx'
    })
    expect(JSONLtoLabels(line)).toStrictEqual([
      { label: 'coffee', ref: TXID, type: 'tx' }
    ])
  })

  it('ignores prototype keys in a record', () => {
    const line = `{"__proto__":{"polluted":true},"constructor":"x","label":"coffee","ref":"${TXID}","type":"tx"}`
    const [label] = JSONLtoLabels(line)
    expect(label).toStrictEqual({ label: 'coffee', ref: TXID, type: 'tx' })
    expect(Object.getPrototypeOf(label)).toBe(Object.prototype)
  })

  it('rejects a record without a valid type or ref', () => {
    expect(() =>
      JSONLtoLabels(JSON.stringify({ label: 'coffee', ref: TXID }))
    ).toThrow(ZodError)
    expect(() =>
      JSONLtoLabels(JSON.stringify({ label: 'coffee', type: 'tx' }))
    ).toThrow(ZodError)
  })

  it('ignores records without a label to store', () => {
    const lines = [
      JSON.stringify({ ref: TXID, spendable: false, type: 'output' }),
      JSON.stringify({ label: 42, ref: TXID, type: 'tx' }),
      JSON.stringify({ label: 'rent', ref: TXID, type: 'tx' })
    ].join('\n')
    expect(JSONLtoLabels(lines)).toStrictEqual([
      { label: 'rent', ref: TXID, type: 'tx' }
    ])
  })

  it('reads ISO times with a compact offset or in local time', () => {
    const [compact, local] = JSONLtoLabels(
      [
        JSON.stringify({
          label: 'a',
          ref: TXID,
          time: '2025-01-23T11:40:35+0100',
          type: 'tx'
        }),
        JSON.stringify({
          label: 'b',
          ref: TXID,
          time: '2025-01-23T11:40:35',
          type: 'tx'
        })
      ].join('\n')
    )
    expect(compact.time).toStrictEqual(new Date('2025-01-23T10:40:35.000Z'))
    expect(local.time).toStrictEqual(new Date('2025-01-23T11:40:35'))
  })

  it('keeps fair market values in any currency', () => {
    const [label] = JSONLtoLabels(
      JSON.stringify({ fmv: { BRL: 5.1 }, label: 'a', ref: TXID, type: 'tx' })
    )
    expect(label.fmv).toStrictEqual({ BRL: 5.1 })
  })

  it('reads lines with Windows line endings', () => {
    const lines = `${JSON.stringify({ label: 'a', ref: TXID, type: 'tx' })}\r\n`
    expect(JSONLtoLabels(lines)).toStrictEqual([
      { label: 'a', ref: TXID, type: 'tx' }
    ])
  })

  it('ignores records whose type BIP-329 does not define', () => {
    const lines = [
      JSON.stringify({ label: 'coffee', ref: TXID, type: 'utxo' }),
      JSON.stringify({ label: 'rent', ref: TXID, type: 'tx' })
    ].join('\n')
    expect(JSONLtoLabels(lines)).toStrictEqual([
      { label: 'rent', ref: TXID, type: 'tx' }
    ])
  })

  it('rejects a line that is not a JSON object', () => {
    expect(() => JSONLtoLabels('["not","an","object"]')).toThrow(
      'Invalid line (JSONL)'
    )
  })
})

describe('json to labels', () => {
  it('reads an exported label array back, including its time', () => {
    const labels = [
      {
        label: 'coffee',
        ref: TXID,
        spendable: true,
        time: new Date('2024-01-01T00:00:00.000Z'),
        type: 'tx' as const
      }
    ]
    expect(bip329parser.JSON(bip329export.JSON(labels))).toStrictEqual(labels)
  })

  it('rejects JSON that is not an array of records', () => {
    expect(() => bip329parser.JSON('{"label":"coffee"}')).toThrow(ZodError)
    expect(() => bip329parser.JSON('["coffee"]')).toThrow(ZodError)
  })

  it('ignores records whose type BIP-329 does not define', () => {
    const json = JSON.stringify([
      { label: 'coffee', ref: TXID, type: 'utxo' },
      { label: 'rent', ref: TXID, type: 'tx' }
    ])
    expect(bip329parser.JSON(json)).toStrictEqual([
      { label: 'rent', ref: TXID, type: 'tx' }
    ])
  })
})

describe('csv to labels', () => {
  it('parses Nonchuk CSV Utxo', () => {
    expect(CSVtoLabels(sampleCsvNonchukUtxo)).toStrictEqual(
      sampleCsvNonchukUtxoExpected
    )
  })

  it('parses Nonchuk CSV Tx', () => {
    expect(CSVtoLabels(sampleCsvNonchukTx)).toStrictEqual(
      sampleCsvNonchukTxExpected
    )
  })

  it('parses Sparrow CSV Utxo', () => {
    expect(CSVtoLabels(sampleCsvSparrowUtxo)).toStrictEqual(
      sampleCsvSparrowUtxoExpected
    )
  })

  it('rejects Sparrow CSV Addresses, which carry no label type', () => {
    for (const sample of sampleCsvSparrowAddr) {
      expect(() => CSVtoLabels(sample)).toThrow(ZodError)
    }
  })

  it('parses Sparrow CSV Tx', () => {
    expect(sampleCsvSparrowTx).toHaveLength(sampleCsvSparrowTxExpected.length)
    for (let i = 0; i < sampleCsvSparrowTx.length; i += 1) {
      expect(CSVtoLabels(sampleCsvSparrowTx[i])).toStrictEqual(
        sampleCsvSparrowTxExpected[i]
      )
    }
  })

  it('reads spendable cells as booleans', () => {
    const csv = `type,ref,spendable,label\noutput,${TXID}:0,false,frozen\noutput,${TXID}:1,true,`
    expect(CSVtoLabels(csv)).toStrictEqual([
      { label: 'frozen', ref: `${TXID}:0`, spendable: false, type: 'output' },
      { label: '', ref: `${TXID}:1`, spendable: true, type: 'output' }
    ])
  })

  it('keeps commas inside quoted cells and reads Windows line endings', () => {
    const csv = `type,ref,label\r\ntx,${TXID},"rent, March ""paid"""\r\n`
    expect(CSVtoLabels(csv)).toStrictEqual([
      { label: 'rent, March "paid"', ref: TXID, type: 'tx' }
    ])
  })

  it('reads its own CSV export back', () => {
    const labels = [
      { label: 'coffee', ref: TXID, spendable: true, type: 'tx' as const }
    ]
    expect(bip329parser.CSV(bip329export.CSV(labels))).toStrictEqual(labels)
  })
})
