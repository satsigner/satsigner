import * as bitcoinjs from 'bitcoinjs-lib'
import { useCallback, useState } from 'react'
import { type PsbtLike } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'

import { type Key, type Secret } from '@/types/models/Account'
import { getMultisigScriptTypeFromScriptVersion } from '@/utils/bitcoin'
import { signPSBTWithSeed } from '@/utils/psbt'

type UsePSBTManagementParams = {
  psbt: PsbtLike | null | undefined
  account?: {
    keys?: Key[]
  }
  decryptedKeys: Key[]
}

export function usePSBTManagement({
  psbt: txBuilderPsbt,
  account,
  decryptedKeys
}: UsePSBTManagementParams) {
  const [signedPsbt, setSignedPsbt] = useState('')
  const [signedPsbts, setSignedPsbts] = useState<Map<number, string>>(new Map())

  const convertPsbtToFinalTransaction = useCallback(
    (psbtHex: string): string => {
      // First, try to combine with original PSBT if available
      const originalPsbtBase64 = txBuilderPsbt?.toBase64()
      let combinedPsbt: bitcoinjs.Psbt | undefined
      let psbt: bitcoinjs.Psbt | undefined

      if (originalPsbtBase64) {
        try {
          const signedPsbtBase64 = Buffer.from(psbtHex, 'hex').toString(
            'base64'
          )
          const originalPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)
          const signedPsbt = bitcoinjs.Psbt.fromBase64(signedPsbtBase64)
          combinedPsbt = originalPsbt.combine(signedPsbt)
        } catch {
          /* silently ignored */
        }
      }

      if (combinedPsbt) {
        try {
          combinedPsbt.finalizeAllInputs()
          const tx = combinedPsbt.extractTransaction()
          const finalTxHex = tx.toHex().toUpperCase()
          return finalTxHex
        } catch {
          const combinedBase64 = combinedPsbt.toBase64()
          return combinedBase64
        }
      }

      // Fallback: try direct PSBT processing without combination
      try {
        psbt = bitcoinjs.Psbt.fromHex(psbtHex)
      } catch {
        return psbtHex
      }

      // Check if inputs are already finalized
      let needsFinalization = false
      const inputDetails = []
      for (let i = 0; i < psbt.data.inputs.length; i += 1) {
        const input = psbt.data.inputs[i]
        const hasFinalScriptSig = !!input.finalScriptSig
        const hasFinalScriptWitness = !!input.finalScriptWitness
        const hasWitnessScript = !!input.witnessScript
        const hasRedeemScript = !!input.redeemScript
        const hasPartialSigs = input.partialSig && input.partialSig.length > 0

        inputDetails.push({
          hasFinalScriptSig,
          hasFinalScriptWitness,
          hasPartialSigs,
          hasRedeemScript,
          hasWitnessScript,
          index: i,
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
        } catch {
          /* silently ignored */
        }
      }

      try {
        const tx = psbt.extractTransaction()
        const finalTxHex = tx.toHex().toUpperCase()
        return finalTxHex
      } catch {
        return psbtHex
      }
    },
    [txBuilderPsbt]
  )

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

  const handleSignWithLocalKey = useCallback(
    async (index: number) => {
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
      const originalPsbtBase64 = txBuilderPsbt?.toBase64()
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
    },
    [decryptedKeys, txBuilderPsbt, updateSignedPsbt]
  )

  const handleSignWithSeedQR = useCallback(
    async (index: number, mnemonic: string) => {
      // Get the cosigner's key details
      const cosignerKey = account?.keys?.[index]
      if (!cosignerKey) {
        toast.error('No key found for this cosigner')
        return
      }

      // Get the original PSBT from transaction builder result
      const originalPsbtBase64 = txBuilderPsbt?.toBase64()
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
    },
    [account, txBuilderPsbt, updateSignedPsbt]
  )

  return {
    convertPsbtToFinalTransaction,
    handleSignWithLocalKey,
    handleSignWithSeedQR,
    setSignedPsbt,
    setSignedPsbts,
    signedPsbt,
    signedPsbts,
    updateSignedPsbt
  }
}
