import * as bitcoinjs from 'bitcoinjs-lib'

import { type Network } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { bytesEqual } from '@/utils/byteArray'

type Prevout = { script: Uint8Array; value: bigint }

function parsePsbt(psbtBase64: string): bitcoinjs.Psbt | null {
  try {
    return bitcoinjs.Psbt.fromBase64(psbtBase64)
  } catch {
    return null
  }
}

function parseTransaction(txHex: string): bitcoinjs.Transaction | null {
  try {
    return bitcoinjs.Transaction.fromHex(txHex)
  } catch {
    return null
  }
}

function outputScriptFor(address: string, network: Network): Uint8Array | null {
  try {
    return bitcoinjs.address.toOutputScript(address, bitcoinjsNetwork(network))
  } catch {
    return null
  }
}

function addressForScript(script: Uint8Array, network: Network): string | null {
  try {
    return bitcoinjs.address.fromOutputScript(script, bitcoinjsNetwork(network))
  } catch {
    return null
  }
}

function prevoutFromNonWitnessUtxo(
  nonWitnessUtxo: Uint8Array,
  outpoint: { hash: Uint8Array; index: number }
): Prevout | undefined {
  try {
    const prevTx = bitcoinjs.Transaction.fromBuffer(nonWitnessUtxo)
    if (!bytesEqual(prevTx.getHash(), outpoint.hash)) {
      return undefined
    }
    return prevTx.outs[outpoint.index]
  } catch {
    return undefined
  }
}

function prevoutForInput(
  psbt: bitcoinjs.Psbt,
  index: number
): Prevout | undefined {
  const { witnessUtxo, nonWitnessUtxo } = psbt.data.inputs[index]
  if (witnessUtxo) {
    return witnessUtxo
  }
  if (!nonWitnessUtxo) {
    return undefined
  }
  return prevoutFromNonWitnessUtxo(nonWitnessUtxo, psbt.txInputs[index])
}

function unsignedTxid(psbt: bitcoinjs.Psbt): string {
  return bitcoinjs.Transaction.fromBuffer(
    psbt.data.globalMap.unsignedTx.toBuffer()
  ).getId()
}

// Input hashes are stored little-endian; outpoints are written big-endian.
function inputOutpoint(input: { hash: Uint8Array; index: number }): string {
  // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
  const txid = Buffer.from(input.hash).reverse().toString('hex')
  return `${txid}:${input.index}`
}

export {
  addressForScript,
  inputOutpoint,
  outputScriptFor,
  parsePsbt,
  parseTransaction,
  type Prevout,
  prevoutForInput,
  unsignedTxid
}
