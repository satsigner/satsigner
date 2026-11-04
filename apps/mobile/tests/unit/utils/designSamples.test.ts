import {
  buildSampleChannels,
  buildSampleChartTransaction,
  buildSampleLogEntries,
  buildSampleUtxos,
  buildSampleWallet,
  createSampleRandom,
  SAMPLE_DUST_LIMIT,
  toSampleSankey
} from '@/utils/designSamples'
import { getTransactionRunningBalances } from '@/utils/walletOwnership'

const WALLET_OPTIONS = {
  end: new Date('2024-07-02T08:45:00Z'),
  endHeight: 850_100,
  seed: 42,
  spanDays: 1100,
  transactionCount: 300,
  unconfirmedTip: true
}

function outpoint(txid: string, vout: number) {
  return `${txid}:${vout}`
}

describe('createSampleRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = createSampleRandom(7)
    const second = createSampleRandom(7)
    const take = (random: () => number) =>
      Array.from({ length: 5 }, () => random())
    expect(take(first)).toStrictEqual(take(second))
  })

  it('stays within [0, 1)', () => {
    const random = createSampleRandom(1)
    const values = Array.from({ length: 1000 }, () => random())
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
  })
})

describe('buildSampleUtxos', () => {
  const utxos = buildSampleUtxos({ count: 200, max: 50_000, min: 546, seed: 3 })

  it('returns the requested count within bounds', () => {
    expect(utxos).toHaveLength(200)
    expect(
      utxos.every(
        (utxo) => utxo.value >= SAMPLE_DUST_LIMIT && utxo.value <= 50_000
      )
    ).toBe(true)
  })

  it('has unique outpoints', () => {
    const keys = new Set(utxos.map((utxo) => outpoint(utxo.txid, utxo.vout)))
    expect(keys.size).toBe(utxos.length)
  })

  it('is deterministic', () => {
    expect(
      buildSampleUtxos({ count: 200, max: 50_000, min: 546, seed: 3 })
    ).toStrictEqual(utxos)
  })
})

describe('buildSampleWallet', () => {
  const wallet = buildSampleWallet(WALLET_OPTIONS)

  it('returns the requested transaction count', () => {
    expect(wallet.transactions).toHaveLength(300)
  })

  it('only leaves utxos that come from its own transactions', () => {
    const outputs = new Set(
      wallet.transactions.flatMap((transaction) =>
        transaction.vout.map((_, vout) => outpoint(transaction.id, vout))
      )
    )
    expect(
      wallet.utxos.every((utxo) => outputs.has(outpoint(utxo.txid, utxo.vout)))
    ).toBe(true)
  })

  it('never spends an output twice', () => {
    const spent = wallet.transactions.flatMap((transaction) =>
      transaction.vin.map((input) =>
        outpoint(input.previousOutput.txid, input.previousOutput.vout)
      )
    )
    expect(new Set(spent).size).toBe(spent.length)
  })

  it('keeps the running balance non-negative and equal to the utxo total', () => {
    const balances = [
      ...getTransactionRunningBalances(wallet.transactions).values()
    ]
    expect(balances.every((balance) => balance >= 0)).toBe(true)
    const utxoTotal = wallet.utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    expect(balances.at(-1)).toBe(utxoTotal)
  })

  it('leaves only the tip unconfirmed', () => {
    const unconfirmed = wallet.transactions.filter(
      (transaction) => transaction.blockHeight === undefined
    )
    expect(unconfirmed).toStrictEqual([wallet.transactions.at(-1)])
  })

  it('keeps every output above dust', () => {
    expect(
      wallet.transactions.every((transaction) =>
        transaction.vout.every((output) => output.value >= SAMPLE_DUST_LIMIT)
      )
    ).toBe(true)
  })
})

describe('buildSampleChartTransaction', () => {
  it('balances inputs against outputs plus fee', () => {
    const { transaction } = buildSampleChartTransaction({
      inputCount: 12,
      outputCount: 20,
      seed: 12
    })
    const inputTotal = transaction.vin.reduce(
      (sum, input) => sum + (input.value ?? 0),
      0
    )
    const outputTotal = transaction.vout.reduce(
      (sum, output) => sum + output.value,
      0
    )
    expect(transaction.vout).toHaveLength(21)
    expect(outputTotal + (transaction.fee ?? 0)).toBe(inputTotal)
  })

  it('marks exactly the counterparty input as foreign in a payjoin', () => {
    const { ownedOutpoints, transaction } = buildSampleChartTransaction({
      counterpartyInputCount: 1,
      inputCount: 2,
      outputCount: 1,
      seed: 13
    })
    const foreign = transaction.vin.filter(
      (input) =>
        !ownedOutpoints.has(
          outpoint(input.previousOutput.txid, input.previousOutput.vout)
        )
    )
    expect(foreign).toHaveLength(1)
  })

  it('gives every coinjoin payment the same denomination', () => {
    const { transaction } = buildSampleChartTransaction({
      counterpartyInputCount: 49,
      equalOutputValue: 5_000_000,
      inputCount: 50,
      inputMax: 30_000_000,
      outputCount: 50,
      seed: 14
    })
    const payments = transaction.vout.filter(
      (output) => output.kind !== 'change'
    )
    expect(payments).toHaveLength(50)
    expect(payments.every((output) => output.value === 5_000_000)).toBe(true)
  })

  it('converts to sankey inputs and outputs', () => {
    const sample = buildSampleChartTransaction({
      inputCount: 3,
      outputCount: 2,
      seed: 5
    })
    const sankey = toSampleSankey(sample)
    expect(sankey.inputs.size).toBe(3)
    expect(sankey.outputs).toHaveLength(3)
  })
})

describe('buildSampleChannels', () => {
  it('splits each capacity into local and remote sides', () => {
    const channels = buildSampleChannels(60, 51)
    expect(channels).toHaveLength(60)
    expect(new Set(channels.map((channel) => channel.chanId)).size).toBe(60)
    expect(
      channels.every(
        (channel) => channel.localSats >= 0 && channel.remoteSats >= 0
      )
    ).toBe(true)
  })
})

describe('buildSampleLogEntries', () => {
  it('builds ordered entries with unique ids', () => {
    const entries = buildSampleLogEntries(500, 61)
    expect(entries).toHaveLength(500)
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(500)
    expect(
      entries.every(
        (entry, index) => index === 0 || entry.time >= entries[index - 1].time
      )
    ).toBe(true)
  })
})
