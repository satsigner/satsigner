import * as bitcoinjs from 'bitcoinjs-lib'

import { type Account } from '@/types/models/Account'
import { bitcoinjsNetwork } from '@/utils/bitcoin'

type PsbtInput = {
  witnessUtxo?: {
    script: Buffer
    value: number
  }
  nonWitnessUtxo?: Buffer
}

export type ExtractedTransactionData = {
  inputs: {
    txid: string
    vout: number
    value: number
    script: string
    address?: string
    label?: string
    keychain?: 'internal' | 'external'
  }[]
  outputs: {
    address: string
    value: number
    script: string
    label?: string
  }[]
  fee: number
  network: 'mainnet' | 'testnet' | 'signet'
}

/**
 * Extract transaction ID from PSBT
 */
export function extractTransactionIdFromPSBT(
  psbtBase64: string
): string | null {
  try {
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

    try {
      const tx = psbt.extractTransaction()
      return tx.getId()
    } catch {
      const unsignedTx = psbt.data.globalMap.unsignedTx
      if (unsignedTx) {
        const txBuffer = unsignedTx.toBuffer()
        const hash = bitcoinjs.crypto.hash256(txBuffer)
        return hash.reverse().toString('hex')
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Extract transaction data from PSBT for sankey chart visualization
 * Gets inputs/outputs directly from PSBT structure instead of raw message content
 */
export function extractTransactionDataFromPSBTEnhanced(
  psbtBase64: string,
  account: Account
): ExtractedTransactionData | null {
  try {
    if (!psbtBase64 || !account) return null

    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
    const network = bitcoinjsNetwork(account.network)

    const inputs = psbt.data.inputs.map((input, index) => {
      const psbtInput = input as PsbtInput
      const txInput = psbt.txInputs[index]
      const txid = txInput.hash.reverse().toString('hex')
      const vout = txInput.index

      let value = 0
      let script = ''
      let address = ''

      if (psbtInput.witnessUtxo) {
        value = psbtInput.witnessUtxo.value
        script = psbtInput.witnessUtxo.script?.toString('hex') || ''
      } else if (psbtInput.nonWitnessUtxo) {
        try {
          const prevTx = bitcoinjs.Transaction.fromBuffer(
            psbtInput.nonWitnessUtxo
          )
          const prevOut = prevTx.outs[vout]
          value = prevOut?.value || 0
          script = prevOut?.script?.toString('hex') || ''
        } catch {
          value = 0
        }
      }

      try {
        if (script) {
          address = bitcoinjs.address.fromOutputScript(
            Buffer.from(script, 'hex'),
            network
          )
        }
      } catch {
        address = `Unknown Input ${index + 1}`
      }

      return {
        txid,
        vout,
        value,
        script,
        address,
        label: `Input ${index + 1}`,
        keychain: 'external' as const
      }
    })

    const outputs = psbt.txOutputs.map((output, index) => {
      const script = output.script.toString('hex')
      const value = output.value
      let address = ''

      try {
        address = bitcoinjs.address.fromOutputScript(
          Buffer.from(script, 'hex'),
          network
        )
      } catch {
        address = `Unknown Address ${index + 1}`
      }

      return {
        address,
        value,
        script,
        label: `Output ${index + 1}`
      }
    })

    const totalInputValue = inputs.reduce(
      (sum, input) => sum + (input.value || 0),
      0
    )
    const totalOutputValue = outputs.reduce(
      (sum, output) => sum + (output.value || 0),
      0
    )
    const fee = Math.max(totalInputValue - totalOutputValue, 0)

    return {
      inputs,
      outputs,
      fee,
      network: (account.network === 'bitcoin' ? 'mainnet' : account.network) as
        | 'mainnet'
        | 'testnet'
        | 'signet'
    }
  } catch (error) {
    console.error('❌ Failed to extract transaction data from PSBT:', error)
    return null
  }
}
