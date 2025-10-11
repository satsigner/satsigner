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
  } catch {
    return null
  }
}

// Function to combine multiple base64 PSBTs
export function combinePsbts(psbtBase64s: string[]): string {
  if (psbtBase64s.length === 0) {
    throw new Error('No PSBTs provided to combine.')
  }

  // Use the first PSBT as the base. It should contain the unsigned transaction.
  const basePsbt = bitcoinjs.Psbt.fromBase64(psbtBase64s[0])

  // Combine all other PSBTs into the base.
  for (let i = 1; i < psbtBase64s.length; i++) {
    const nextPsbt = bitcoinjs.Psbt.fromBase64(psbtBase64s[i])
    basePsbt.combine(nextPsbt)
  }

  return basePsbt.toBase64()
}

// Function to reconstruct the original (unsigned) PSBT
export function extractOriginalPsbt(psbtBase64: string): string {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  const tx = bitcoinjs.Transaction.fromBuffer(
    psbt.data.globalMap.unsignedTx.toBuffer()
  )

  // Create a new PSBT from the unsigned transaction of the original PSBT
  const newPsbt = new bitcoinjs.Psbt()
  newPsbt.setVersion(tx.version)
  newPsbt.setLocktime(tx.locktime)

  // Add inputs from the original transaction, but without any signature data
  psbt.txInputs.forEach((input) => {
    newPsbt.addInput({
      hash: input.hash,
      index: input.index,
      sequence: input.sequence
    })
  })

  // Add all outputs from the original transaction
  psbt.txOutputs.forEach((output) => {
    newPsbt.addOutput({
      script: output.script,
      value: output.value
    })
  })

  // Copy over essential non-signature data from the original PSBT's inputs
  psbt.data.inputs.forEach((input, index) => {
    // We only copy fields that are necessary for signing and are not signatures themselves
    const {
      partialSig: _partialSig,
      finalScriptSig: _finalScriptSig,
      finalScriptWitness: _finalScriptWitness,
      ...nonSignatureData
    } = input
    newPsbt.updateInput(index, nonSignatureData)
  })

  // Copy over essential non-signature data from the original PSBT's outputs
  psbt.data.outputs.forEach((output, index) => {
    newPsbt.updateOutput(index, output)
  })

  return newPsbt.toBase64()
}

// Function to extract multisig m-of-n info
export function getMultisigInfoFromPsbt(psbtBase64: string): {
  required: number
  total: number
} | null {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  if (psbt.data.inputs.length === 0) return null

  const firstInput = psbt.data.inputs[0]
  const script = firstInput.witnessScript || firstInput.redeemScript

  if (!script) return null

  try {
    const decompiled = bitcoinjs.script.decompile(script)
    if (!decompiled || decompiled.length < 4) return null // e.g., OP_M <pubkeys...> OP_N OP_CHECKMULTISIG

    const mOp = decompiled[0]
    const nOp = decompiled[decompiled.length - 2]

    const m = bitcoinjs.script.number.decode(
      Buffer.isBuffer(mOp) ? mOp : Buffer.from([mOp - 80])
    )
    const n = bitcoinjs.script.number.decode(
      Buffer.isBuffer(nOp) ? nOp : Buffer.from([nOp - 80])
    )

    return { required: m, total: n }
  } catch {
    return null
  }
}

// Function to get the set of unique public keys that have signed
export function getCollectedSignerPubkeys(psbtBase64: string): Set<string> {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

  const signerPubkeys = new Set<string>()

  if (psbt.data.inputs) {
    for (const input of psbt.data.inputs) {
      if (input.partialSig && input.partialSig.length > 0) {
        for (const sig of input.partialSig) {
          signerPubkeys.add(sig.pubkey.toString('hex'))
        }
      }
    }
  } else {
  }

  return signerPubkeys
}
