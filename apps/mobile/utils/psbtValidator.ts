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

    // Validate inputs and outputs
    if (!validateInputsAndOutputs(psbt)) {
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

      // Parse witness script to get threshold and public keys
      let threshold = 0
      let totalKeys = 0

      try {
        const script = bitcoinjs.script.decompile(input.witnessScript)
        if (script && script.length >= 3) {
          const op = script[0]
          if (typeof op === 'number' && op >= 81 && op <= 96) {
            threshold = op - 80 // Convert OP_M to actual threshold (OP_2 = 82 -> threshold = 2)
            // Count only the Buffer elements (public keys) in the script
            // Script format: [OP_M, pubkey1, pubkey2, ..., pubkeyN, OP_N, OP_CHECKMULTISIG]
            const publicKeyCount = script.filter(
              (item) =>
                item &&
                typeof item === 'object' &&
                (Buffer.isBuffer(item) || (item as any).type === 'Buffer')
            ).length
            totalKeys = publicKeyCount
          }
        }
      } catch (_error) {
        return false
      }

      // Validate threshold and key count
      if (threshold === 0 || totalKeys === 0 || threshold > totalKeys) {
        return false
      }

      // Count signatures for this input
      let signatureCount = 0
      if (input.partialSig) {
        signatureCount = Array.isArray(input.partialSig)
          ? input.partialSig.length
          : 1
      }

      // For multisig, we should have at least some signatures
      if (signatureCount === 0) {
        return false
      }

      // Validate that we don't have more signatures than total keys
      if (signatureCount > totalKeys) {
        return false
      }

      // Check if signatures are valid (basic format check)
      if (input.partialSig) {
        const sigs = Array.isArray(input.partialSig)
          ? input.partialSig
          : [input.partialSig]
        for (const sig of sigs) {
          if (!sig.pubkey || !sig.signature) {
            return false
          }
          // Basic signature length check (64-72 bytes for DER encoding)
          if (sig.signature.length < 64 || sig.signature.length > 72) {
            return false
          }
        }
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
        signatureCount = Array.isArray(input.partialSig)
          ? input.partialSig.length
          : 1
      }

      // For single-sig, we should have exactly 1 signature
      if (signatureCount !== 1) {
        return false
      }

      // Validate signature format
      if (input.partialSig) {
        const sig = Array.isArray(input.partialSig)
          ? input.partialSig[0]
          : input.partialSig
        if (!sig.pubkey || !sig.signature) {
          return false
        }
        // Basic signature length check (64-72 bytes for DER encoding)
        if (sig.signature.length < 64 || sig.signature.length > 72) {
          return false
        }
      }
    }

    return true
  } catch (_error) {
    return false
  }
}

/**
 * Validate inputs and outputs structure
 */
function validateInputsAndOutputs(psbt: bitcoinjs.Psbt): boolean {
  try {
    // Validate inputs
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      const input = psbt.data.inputs[i]

      // Check for required fields
      if (!input.witnessUtxo && !input.nonWitnessUtxo) {
        return false
      }

      // Validate UTXO structure
      if (input.witnessUtxo) {
        if (
          !input.witnessUtxo.script ||
          input.witnessUtxo.value === undefined
        ) {
          return false
        }
        if (input.witnessUtxo.value <= 0) {
          return false
        }
      }

      if (input.nonWitnessUtxo) {
        // nonWitnessUtxo is a Buffer containing the full transaction
        // We can't easily validate individual fields without parsing the transaction
        if (!input.nonWitnessUtxo || input.nonWitnessUtxo.length === 0) {
          return false
        }
      }
    }

    // Validate outputs
    for (let i = 0; i < psbt.data.outputs.length; i++) {
      const output = psbt.data.outputs[i]

      // Check for required fields - PsbtOutput doesn't have script property
      // Output validation is handled by the PSBT structure itself
      if (!output) {
        return false
      }
    }

    return true
  } catch (_error) {
    return false
  }
}

/**
 * Validate signature threshold for multisig
 */
export function validateSignatureThreshold(
  psbt: bitcoinjs.Psbt,
  requiredSignatures: number
): boolean {
  try {
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      const input = psbt.data.inputs[i]

      if (!input.witnessScript) {
        continue // Skip non-multisig inputs
      }

      // Parse witness script to get threshold
      let threshold = 0
      try {
        const script = bitcoinjs.script.decompile(input.witnessScript)
        if (script && script.length >= 3) {
          const op = script[0]
          if (typeof op === 'number' && op >= 1 && op <= 16) {
            threshold = op
          }
        }
      } catch (_error) {
        return false
      }

      // Count current signatures
      let signatureCount = 0
      if (input.partialSig) {
        signatureCount = Array.isArray(input.partialSig)
          ? input.partialSig.length
          : 1
      }

      // Check if we have enough signatures
      if (signatureCount < Math.min(threshold, requiredSignatures)) {
        return false
      }
    }

    return true
  } catch (_error) {
    return false
  }
}
