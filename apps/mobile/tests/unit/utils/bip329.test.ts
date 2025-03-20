import { CSVtoLabels, JSONLtoLabels } from '@/utils/bip329'

// TODO: rename Nonchunk to Nunchunk
const {
  sampleCsvNonchukTx,
  sampleCsvNonchukTxExpected,
  sampleCsvNonchukUtxo,
  sampleCsvNonchukUtxoExpected,
  sampleCsvSparrowAddr,
  sampleCsvSparrowAddrExpected,
  sampleCsvSparrowTx,
  sampleCsvSparrowTxExpected,
  sampleCsvSparrowUtxo,
  sampleCsvSparrowUtxoExpected,
  sampleJsonl,
  sampleJsonlExpected
} = require('./bip329_samples')

describe('JSONL to labels', () => {
  it('parses JSON to labels', () => {
    expect(JSONLtoLabels(sampleJsonl)).toEqual(sampleJsonlExpected)
  })
})

describe('CSV to labels', () => {
  it('parses Nonchuk CSV Utxo', () => {
    expect(CSVtoLabels(sampleCsvNonchukUtxo)).toEqual(
      sampleCsvNonchukUtxoExpected
    )
  })

  it('parses Nonchuk CSV Tx', () => {
    expect(CSVtoLabels(sampleCsvNonchukTx)).toEqual(sampleCsvNonchukTxExpected)
  })

  it('parses Sparrow CSV Utxo', () => {
    expect(CSVtoLabels(sampleCsvSparrowUtxo)).toEqual(
      sampleCsvSparrowUtxoExpected
    )
  })

  it('parses Sparrow CSV Addresses', () => {
    expect(sampleCsvSparrowAddr.length).toBe(
      sampleCsvSparrowAddrExpected.length
    )
    for (let i = 0; i < sampleCsvSparrowAddr.length; i += 1) {
      expect(CSVtoLabels(sampleCsvSparrowAddr[i])).toEqual(
        sampleCsvSparrowAddrExpected[i]
      )
    }
  })

  it('parses Sparrow CSV Tx', () => {
    expect(sampleCsvSparrowTx.length).toBe(sampleCsvSparrowTxExpected.length)
    for (let i = 0; i < sampleCsvSparrowTx.length; i += 1) {
      expect(CSVtoLabels(sampleCsvSparrowTx[i])).toEqual(
        sampleCsvSparrowTxExpected[i]
      )
    }
  })
})
