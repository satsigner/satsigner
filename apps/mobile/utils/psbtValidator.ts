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
    console.log(
      '🔍 validateSignedPSBT: Starting validation for',
      account.policyType,
      'account'
    )
    // Parse PSBT
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
    console.log(
      '🔍 validateSignedPSBT: PSBT parsed successfully, inputs:',
      psbt.data.inputs.length,
      'outputs:',
      psbt.data.outputs.length
    )

    // Basic PSBT structure validation
    if (!psbt.data.inputs || psbt.data.inputs.length === 0) {
      console.log('❌ validateSignedPSBT: No inputs found')
      return false
    }

    if (!psbt.data.outputs || psbt.data.outputs.length === 0) {
      console.log('❌ validateSignedPSBT: No outputs found')
      return false
    }

    // Validate inputs and outputs
    if (!validateInputsAndOutputs(psbt)) {
      console.log('❌ validateSignedPSBT: Input/output validation failed')
      return false
    }

    // Check if this is a multisig account
    if (account.policyType === 'multisig') {
      const result = validateMultisigPSBT(psbt)
      console.log('🔍 validateSignedPSBT: Multisig validation result:', result)
      return result
    } else {
      // For single-sig accounts, just check basic structure
      const result = validateSinglesigPSBT(psbt)
      console.log('🔍 validateSignedPSBT: Singlesig validation result:', result)
      return result
    }
  } catch (error) {
    console.log('❌ validateSignedPSBT: Error during validation:', error)
    return false
  }
}

/**
 * Validate multisig PSBT structure and signatures
 */
function validateMultisigPSBT(psbt: bitcoinjs.Psbt): boolean {
  try {
    console.log(
      '🔍 validateMultisigPSBT: Starting multisig validation, inputs:',
      psbt.data.inputs.length
    )
    // Check each input for proper multisig structure
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      const input = psbt.data.inputs[i]
      console.log(`🔍 validateMultisigPSBT: Checking input ${i}`)

      // Check if input has witness script (required for multisig)
      if (!input.witnessScript) {
        console.log(
          `❌ validateMultisigPSBT: Input ${i} missing witness script`
        )
        return false
      }

      // Check if input has UTXO data
      if (!input.witnessUtxo && !input.nonWitnessUtxo) {
        console.log(`❌ validateMultisigPSBT: Input ${i} missing UTXO data`)
        return false
      }

      // Parse witness script to get threshold and public keys
      let threshold = 0
      let totalKeys = 0

      try {
        const script = bitcoinjs.script.decompile(input.witnessScript)
        console.log(`🔍 validateMultisigPSBT: Input ${i} script:`, script)
        if (script && script.length >= 3) {
          const op = script[0]
          console.log(
            `🔍 validateMultisigPSBT: Input ${i} first op:`,
            op,
            'type:',
            typeof op
          )
          if (typeof op === 'number' && op >= 81 && op <= 96) {
            threshold = op - 80 // Convert OP_M to actual threshold (OP_2 = 82 -> threshold = 2)
            console.log(
              `🔍 validateMultisigPSBT: Input ${i} threshold:`,
              threshold
            )
            // Count only the Buffer elements (public keys) in the script
            // Script format: [OP_M, pubkey1, pubkey2, ..., pubkeyN, OP_N, OP_CHECKMULTISIG]
            const publicKeyCount = script.filter(
              (item) =>
                item &&
                typeof item === 'object' &&
                (Buffer.isBuffer(item) || (item as any).type === 'Buffer')
            ).length
            totalKeys = publicKeyCount
            console.log(
              `🔍 validateMultisigPSBT: Input ${i} total keys:`,
              totalKeys
            )
          } else {
            console.log(`❌ validateMultisigPSBT: Input ${i} invalid op:`, op)
          }
        } else {
          console.log(
            `❌ validateMultisigPSBT: Input ${i} script too short:`,
            script?.length
          )
        }
      } catch (error) {
        console.log(
          `❌ validateMultisigPSBT: Input ${i} script parsing error:`,
          error
        )
        return false
      }

      // Validate threshold and key count
      if (threshold === 0 || totalKeys === 0 || threshold > totalKeys) {
        console.log(
          `❌ validateMultisigPSBT: Input ${i} invalid threshold/key count: threshold=${threshold}, totalKeys=${totalKeys}`
        )
        return false
      }

      // Count signatures for this input
      let signatureCount = 0
      if (input.partialSig) {
        signatureCount = Array.isArray(input.partialSig)
          ? input.partialSig.length
          : 1
        console.log(
          `🔍 validateMultisigPSBT: Input ${i} signature count:`,
          signatureCount
        )
      } else {
        console.log(`🔍 validateMultisigPSBT: Input ${i} no partial signatures`)
      }

      // For multisig, we should have at least some signatures
      if (signatureCount === 0) {
        console.log(`❌ validateMultisigPSBT: Input ${i} no signatures found`)
        return false
      }

      // Validate that we don't have more signatures than total keys
      if (signatureCount > totalKeys) {
        console.log(
          `❌ validateMultisigPSBT: Input ${i} too many signatures: ${signatureCount} > ${totalKeys}`
        )
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
          if (typeof op === 'number' && op >= 81 && op <= 96) {
            threshold = op - 80 // Convert OP_M to actual threshold (OP_2 = 82 -> threshold = 2)
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

/**
 * Validate that a signed PSBT contains signatures from the specific cosigner's public key
 * @param psbtBase64 - Base64 encoded PSBT
 * @param cosignerPublicKey - The public key of the specific cosigner (hex string)
 * @returns true if the PSBT contains signatures from the specified cosigner
 */
export function validateCosignerSignature(
  psbtBase64: string,
  cosignerPublicKey: string
): boolean {
  try {
    // Parse PSBT
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

    // Check if PSBT has any signatures
    let hasAnySignatures = false
    let hasCosignerSignature = false

    // Check each input for signatures from the specific cosigner
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      const input = psbt.data.inputs[i]

      if (input.partialSig && input.partialSig.length > 0) {
        hasAnySignatures = true

        // Check if any signature is from the specific cosigner
        const signatures = Array.isArray(input.partialSig)
          ? input.partialSig
          : [input.partialSig]

        for (const sig of signatures) {
          if (sig.pubkey && sig.pubkey.toString('hex') === cosignerPublicKey) {
            hasCosignerSignature = true
            break
          }
        }
      }
    }

    // Return true only if we have signatures AND at least one is from the cosigner
    return hasAnySignatures && hasCosignerSignature
  } catch (_error) {
    return false
  }
}

/**
 * Validate signed PSBT for a specific cosigner in multisig
 * @param psbtBase64 - Base64 encoded PSBT
 * @param account - Account with keys for validation
 * @param cosignerIndex - Index of the specific cosigner to validate for
 * @returns true if validation passes for the specific cosigner
 */
export function validateSignedPSBTForCosigner(
  psbtBase64: string,
  account: Account,
  cosignerIndex: number
): boolean {
  try {
    // First do basic PSBT validation
    if (!validateSignedPSBT(psbtBase64, account)) {
      return false
    }

    // For multisig accounts, check if the signature belongs to the specific cosigner
    if (
      account.policyType === 'multisig' &&
      account.keys &&
      account.keys[cosignerIndex]
    ) {
      const cosignerKey = account.keys[cosignerIndex]

      // Parse PSBT to get BIP32 derivations
      const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

      // Extract the public key from the cosigner's key details
      let cosignerPublicKey = ''

      if (
        typeof cosignerKey.secret === 'object' &&
        cosignerKey.secret.extendedPublicKey
      ) {
        // For extended public keys, we need to find the specific derivation used in the PSBT
        // Look for BIP32 derivations that match this cosigner's fingerprint
        const cosignerFingerprint = cosignerKey.fingerprint

        if (cosignerFingerprint) {
          // Find derivations in PSBT that match this cosigner's fingerprint
          for (let i = 0; i < psbt.data.inputs.length; i++) {
            const input = psbt.data.inputs[i]

            if (input.bip32Derivation) {
              for (const derivation of input.bip32Derivation) {
                const derivationFingerprint =
                  derivation.masterFingerprint.toString('hex')

                if (derivationFingerprint === cosignerFingerprint) {
                  // Found a derivation for this cosigner, use its public key
                  cosignerPublicKey = derivation.pubkey.toString('hex')
                  break
                }
              }
            }

            if (cosignerPublicKey) break
          }
        }

        // Fallback: if we couldn't find the specific derivation, use the extended public key
        if (!cosignerPublicKey) {
          cosignerPublicKey = cosignerKey.secret.extendedPublicKey
        }
      } else if (cosignerKey.fingerprint) {
        // If we only have fingerprint, try to find the public key from PSBT derivations
        const cosignerFingerprint = cosignerKey.fingerprint

        for (let i = 0; i < psbt.data.inputs.length; i++) {
          const input = psbt.data.inputs[i]

          if (input.bip32Derivation) {
            for (const derivation of input.bip32Derivation) {
              const derivationFingerprint =
                derivation.masterFingerprint.toString('hex')

              if (derivationFingerprint === cosignerFingerprint) {
                cosignerPublicKey = derivation.pubkey.toString('hex')
                break
              }
            }
          }

          if (cosignerPublicKey) break
        }
      }

      // If we have a public key, validate that the PSBT contains signatures from this cosigner
      if (cosignerPublicKey) {
        return validateCosignerSignature(psbtBase64, cosignerPublicKey)
      } else {
        // If we can't determine the public key, we can't validate cosigner-specific signatures
        // In this case, we'll fall back to basic validation but show a warning
        console.warn(
          `Could not determine public key for cosigner ${cosignerIndex}`
        )
        return true
      }
    }

    // For non-multisig or if we can't determine the public key, use basic validation
    return true
  } catch (_error) {
    return false
  }
}
