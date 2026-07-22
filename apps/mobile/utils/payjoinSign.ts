import * as bitcoinjs from 'bitcoinjs-lib'

import { type Utxo } from '@/types/models/Utxo'
import { utxoScriptHex } from '@/utils/payjoinWallet'

function txidFromPsbtInputHash(hash: Buffer | Uint8Array): string {
  return Buffer.from(hash).reverse().toString('hex')
}

/**
 * BDK `wallet.sign` throws `SignerMissingNonWitnessUtxo` when a wallet input
 * lacks the previous transaction — Payjoin provisional PSBTs often only carry
 * `witness_utxo`. Fill prev-tx bytes (and witness_utxo) for our UTXOs first.
 */
function preparePayjoinPsbtForWalletSign(params: {
  psbtBase64: string
  utxos: Utxo[]
  getPrevTxHex: (txid: string) => string | undefined
}): string {
  const psbt = bitcoinjs.Psbt.fromBase64(params.psbtBase64)
  const owned = new Map(
    params.utxos.map((utxo) => [`${utxo.txid}:${utxo.vout}`, utxo])
  )

  for (let index = 0; index < psbt.inputCount; index += 1) {
    const txInput = psbt.txInputs[index]
    if (!txInput) {
      continue
    }
    const txid = txidFromPsbtInputHash(txInput.hash)
    const utxo = owned.get(`${txid}:${txInput.index}`)
    if (!utxo) {
      continue
    }

    const patch: {
      nonWitnessUtxo?: Buffer
      witnessUtxo?: { script: Buffer; value: number }
    } = {}

    const scriptHex = utxoScriptHex(utxo)
    if (!psbt.data.inputs[index]?.witnessUtxo && scriptHex) {
      patch.witnessUtxo = {
        script: Buffer.from(scriptHex, 'hex'),
        value: utxo.value
      }
    }

    if (!psbt.data.inputs[index]?.nonWitnessUtxo) {
      const prevHex = params.getPrevTxHex(txid)
      if (prevHex) {
        patch.nonWitnessUtxo = Buffer.from(prevHex, 'hex')
      }
    }

    if (Object.keys(patch).length > 0) {
      psbt.updateInput(index, patch)
    }
  }

  return psbt.toBase64()
}

export { preparePayjoinPsbtForWalletSign }
