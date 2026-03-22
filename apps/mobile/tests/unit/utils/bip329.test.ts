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

describe('jSONL to labels', () => {
  it('parses JSON to labels', () => {
    expect(JSONLtoLabels(sampleJsonl)).toStrictEqual(sampleJsonlExpected)
  })
})

describe('cSV to labels', () => {
  it('parses Nonchuk CSV Utxo', () => {
    expect(CSVtoLabels(sampleCsvNonchukUtxo)).toStrictEqual(
      sampleCsvNonchukUtxoExpected
    )
  })

  it('parses Nonchuk CSV Tx', () => {
    expect(CSVtoLabels(sampleCsvNonchukTx)).toStrictEqual(sampleCsvNonchukTxExpected)
  })

  it('parses Sparrow CSV Utxo', () => {
    expect(CSVtoLabels(sampleCsvSparrowUtxo)).toStrictEqual(
      sampleCsvSparrowUtxoExpected
    )
  })

  it('parses Sparrow CSV Addresses', () => {
    expect(sampleCsvSparrowAddr).toHaveLength(
      sampleCsvSparrowAddrExpected.length
    )
    for (let i = 0; i < sampleCsvSparrowAddr.length; i += 1) {
      expect(CSVtoLabels(sampleCsvSparrowAddr[i])).toStrictEqual(
        sampleCsvSparrowAddrExpected[i]
      )
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
})
