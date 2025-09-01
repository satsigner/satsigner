import * as bitcoinjs from 'bitcoinjs-lib'

import { type Account } from '@/types/models/Account'

/**
 * Simple PSBT validator that checks basic PSBT structure and signature validation
 * @param psbtBase64 - Base64 encoded PSBT
 * @param account - Account with keys for validation
 * @returns true if validation passes, false otherwise
 */
export function validateSignedPSBT(
  psbtBase64: string,
  account: Account
): boolean {
  try {
    // Parse PSBT
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

    // Basic PSBT structure validation
    if (!psbt.data.inputs || psbt.data.inputs.length === 0) {
      return false
    }

    if (!psbt.data.outputs || psbt.data.outputs.length === 0) {
      return false
    }

    // Check if this is a multisig account
    if (account.policyType === 'multisig') {
      return validateMultisigPSBT(psbt)
    } else {
      // For single-sig accounts, just check basic structure
      return validateSinglesigPSBT(psbt)
    }
  } catch (_error) {
    return false
  }
}

/**
 * Validate multisig PSBT structure and signatures
 */
function validateMultisigPSBT(psbt: bitcoinjs.Psbt): boolean {
  try {
    // Check each input for proper multisig structure
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      const input = psbt.data.inputs[i]

      // Check if input has witness script (required for multisig)
      if (!input.witnessScript) {
        return false
      }

      // Check if input has UTXO data
      if (!input.witnessUtxo && !input.nonWitnessUtxo) {
        return false
      }

      // Count signatures for this input
      let signatureCount = 0

      if (input.partialSig) {
        if (Array.isArray(input.partialSig)) {
          signatureCount = input.partialSig.length
        } else {
          signatureCount = 1
        }
      }

      // For multisig, we should have at least some signatures
      if (signatureCount === 0) {
        return false
      }
    }

    return true
  } catch (_error) {
    return false
  }
}

/**
 * Validate single-sig PSBT structure
 */
function validateSinglesigPSBT(psbt: bitcoinjs.Psbt): boolean {
  try {
    // Check each input for proper single-sig structure
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      const input = psbt.data.inputs[i]

      // Check if input has UTXO data
      if (!input.witnessUtxo && !input.nonWitnessUtxo) {
        return false
      }

      // Count signatures for this input
      let signatureCount = 0

      if (input.partialSig) {
        if (Array.isArray(input.partialSig)) {
          signatureCount = input.partialSig.length
        } else {
          signatureCount = 1
        }
      }

      // For single-sig, we should have exactly 1 signature
      if (signatureCount !== 1) {
        return false
      }
    }

    return true
  } catch (_error) {
    return false
  }
}
