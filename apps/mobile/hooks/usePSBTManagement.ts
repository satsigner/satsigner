import { type TxBuilderResult } from 'bdk-rn/lib/classes/Bindings'
import bitcoinjs from 'bitcoinjs-lib'
import { useCallback, useState } from 'react'
import { toast } from 'sonner-native'

import { type Key, type Secret } from '@/types/models/Account'
import { getMultisigScriptTypeFromScriptVersion } from '@/utils/bitcoin'
import { signPSBTWithSeed } from '@/utils/psbt'

type UsePSBTManagementParams = {
  txBuilderResult: TxBuilderResult | null | undefined
  account?: {
    keys?: Key[]
  }
  decryptedKeys: Key[]
}

type UsePSBTManagementReturn = {
  signedPsbt: string
  signedPsbts: Map<number, string>
  setSignedPsbt: (psbt: string) => void
  setSignedPsbts: (psbts: Map<number, string>) => void
  convertPsbtToFinalTransaction: (psbtHex: string) => string
  handleSignWithLocalKey: (index: number) => Promise<void>
  handleSignWithSeedQR: (index: number, mnemonic: string) => Promise<void>
  updateSignedPsbt: (index: number, psbt: string) => void
}

/**
 * Custom hook for managing PSBT operations including signing, conversion, and state management
 * Extracted from PreviewMessage component to improve maintainability and reusability
 */
export function usePSBTManagement({
  txBuilderResult,
  account,
  decryptedKeys
}: UsePSBTManagementParams): UsePSBTManagementReturn {
  const [signedPsbt, setSignedPsbt] = useState('')
  const [signedPsbts, setSignedPsbts] = useState<Map<number, string>>(new Map())

  /**
   * Convert PSBT hex to final transaction hex
   * Handles PSBT combination, finalization, and transaction extraction
   */
  const convertPsbtToFinalTransaction = useCallback(
    (psbtHex: string): string => {
      try {
        // First, try to combine with original PSBT if available
        const originalPsbtBase64 = txBuilderResult?.psbt?.base64
        if (originalPsbtBase64) {
          try {
            // Convert hex PSBT to base64 for combination
            const signedPsbtBase64 = Buffer.from(psbtHex, 'hex').toString(
              'base64'
            )

            // Combine the PSBTs using bitcoinjs-lib
            const originalPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)
            const signedPsbt = bitcoinjs.Psbt.fromBase64(signedPsbtBase64)

            // Combine the PSBTs - this merges the signatures from signed PSBT with the full data from original PSBT
            const combinedPsbt = originalPsbt.combine(signedPsbt)

            // Try to finalize the combined PSBT
            try {
              combinedPsbt.finalizeAllInputs()

              // Extract the final transaction
              const tx = combinedPsbt.extractTransaction()
              const finalTxHex = tx.toHex().toUpperCase()

              return finalTxHex
            } catch (finalizeError) {
              // If finalization fails, check for UTXO-related errors
              if (
                finalizeError instanceof Error &&
                (finalizeError.message.includes('UTXO') ||
                  finalizeError.message.includes('not found') ||
                  finalizeError.message.includes('database'))
              ) {
                // Return the combined PSBT as base64 instead of trying to finalize
                const combinedBase64 = combinedPsbt.toBase64()
                return combinedBase64
              }

              // For other finalization errors, return the combined PSBT as base64
              const combinedBase64 = combinedPsbt.toBase64()
              return combinedBase64
            }
          } catch (_combineError) {
            // Fall back to direct PSBT processing
          }
        }

        // Fallback: try direct PSBT processing without combination
        const psbt = bitcoinjs.Psbt.fromHex(psbtHex)

        // Check if inputs are already finalized
        let needsFinalization = false
        const inputDetails = []
        for (let i = 0; i < psbt.data.inputs.length; i++) {
          const input = psbt.data.inputs[i]
          const hasFinalScriptSig = !!input.finalScriptSig
          const hasFinalScriptWitness = !!input.finalScriptWitness
          const hasWitnessScript = !!input.witnessScript
          const hasRedeemScript = !!input.redeemScript
          const hasPartialSigs = input.partialSig && input.partialSig.length > 0

          inputDetails.push({
            index: i,
            hasFinalScriptSig,
            hasFinalScriptWitness,
            hasWitnessScript,
            hasRedeemScript,
            hasPartialSigs,
            partialSigCount: input.partialSig?.length || 0
          })

          if (!hasFinalScriptSig && !hasFinalScriptWitness) {
            needsFinalization = true
          }
        }

        // Try to finalize all inputs if needed
        if (needsFinalization) {
          try {
            psbt.finalizeAllInputs()
          } catch (finalizeError) {
            // Check if this is a "No script found" error - this means the PSBT is incomplete
            if (
              finalizeError instanceof Error &&
              finalizeError.message &&
              finalizeError.message.includes('No script found')
            ) {
              // For incomplete PSBTs, return the hex as-is since we can't finalize without the missing data
              return psbtHex
            }

            // Check for UTXO-related errors
            if (
              finalizeError instanceof Error &&
              (finalizeError.message.includes('UTXO') ||
                finalizeError.message.includes('not found') ||
                finalizeError.message.includes('database'))
            ) {
              // Return the PSBT hex as-is to avoid UTXO errors
              return psbtHex
            }

            // For other finalization errors, try to extract what we can
            try {
              const tx = psbt.extractTransaction()
              const finalTxHex = tx.toHex().toUpperCase()
              return finalTxHex
            } catch (_extractError) {
              return psbtHex
            }
          }
        }

        // Extract the final transaction
        try {
          const tx = psbt.extractTransaction()
          const finalTxHex = tx.toHex().toUpperCase()

          return finalTxHex
        } catch (_extractError) {
          return psbtHex
        }
      } catch (_error) {
        // If all else fails, return the original hex
        return psbtHex
      }
    },
    [txBuilderResult]
  )

  /**
   * Update signed PSBT for a specific cosigner
   */
  const updateSignedPsbt = useCallback((index: number, psbt: string) => {
    if (index === -1) {
      // Watch-only mode - use the old behavior
      setSignedPsbt(psbt)
    } else {
      // Update the specific cosigner's signed PSBT
      setSignedPsbts((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, psbt)
        return newMap
      })
    }
  }, [])

  /**
   * Handle signing with local key for a specific cosigner
   */
  const handleSignWithLocalKey = useCallback(
    async (index: number) => {
      try {
        const cosignerKey = decryptedKeys[index]
        if (!cosignerKey?.secret) {
          toast.error('No decrypted key found for this cosigner')
          return
        }

        // Check if the key has a mnemonic
        const secret = cosignerKey.secret as Secret
        if (!secret.mnemonic) {
          toast.error('No mnemonic found for this cosigner')
          return
        }

        // Get the original PSBT from transaction builder result
        const originalPsbtBase64 = txBuilderResult?.psbt?.base64
        if (!originalPsbtBase64) {
          toast.error('No original PSBT found')
          return
        }

        // Get the script type from the cosigner's key
        const scriptVersion = cosignerKey.scriptVersion || 'P2WSH'
        const scriptType = getMultisigScriptTypeFromScriptVersion(
          scriptVersion
        ) as 'P2WSH' | 'P2SH' | 'P2SH-P2WSH'

        // Sign the PSBT with the cosigner's seed
        const signingResult = signPSBTWithSeed(
          originalPsbtBase64,
          secret.mnemonic,
          scriptType
        )

        if (signingResult.success && signingResult.signedPSBT) {
          // Update the signed PSBT for this cosigner
          updateSignedPsbt(index, signingResult.signedPSBT)

          toast.success(`PSBT signed successfully for cosigner ${index + 1}`)
        } else {
          toast.error(`Failed to sign PSBT: ${signingResult.error}`)
        }
      } catch (error) {
        const errorMessage = (error as Error).message
        toast.error(`Error signing with local key: ${errorMessage}`)
      }
    },
    [decryptedKeys, txBuilderResult, updateSignedPsbt]
  )

  /**
   * Handle signing with scanned seed QR for dropped seeds
   */
  const handleSignWithSeedQR = useCallback(
    async (index: number, mnemonic: string) => {
      try {
        // Get the cosigner's key details
        const cosignerKey = account?.keys?.[index]
        if (!cosignerKey) {
          toast.error('No key found for this cosigner')
          return
        }

        // Get the original PSBT from transaction builder result
        const originalPsbtBase64 = txBuilderResult?.psbt?.base64
        if (!originalPsbtBase64) {
          toast.error('No original PSBT found')
          return
        }

        // Get the script type from the cosigner's key
        const scriptVersion = cosignerKey.scriptVersion || 'P2WSH'
        const scriptType = getMultisigScriptTypeFromScriptVersion(
          scriptVersion
        ) as 'P2WSH' | 'P2SH' | 'P2SH-P2WSH'

        // Sign the PSBT with the scanned seed
        const signingResult = signPSBTWithSeed(
          originalPsbtBase64,
          mnemonic,
          scriptType
        )

        if (signingResult.success && signingResult.signedPSBT) {
          // Update the signed PSBT for this cosigner
          updateSignedPsbt(index, signingResult.signedPSBT)

          toast.success(
            `PSBT signed successfully with scanned seed for cosigner ${index + 1}`
          )
        } else {
          toast.error(`Failed to sign PSBT: ${signingResult.error}`)
        }
      } catch (error) {
        const errorMessage = (error as Error).message
        toast.error(`Error signing with scanned seed: ${errorMessage}`)
      }
    },
    [account, txBuilderResult, updateSignedPsbt]
  )

  return {
    signedPsbt,
    signedPsbts,
    setSignedPsbt,
    setSignedPsbts,
    convertPsbtToFinalTransaction,
    handleSignWithLocalKey,
    handleSignWithSeedQR,
    updateSignedPsbt
  }
}
