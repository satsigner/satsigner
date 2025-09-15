import { useMemo } from 'react'

import { type Key } from '@/types/models/Account'

type UseKeyValidationParams = {
  keyDetails: Key | undefined
  seedDropped: boolean
  decryptedKey?: Key
}

type UseKeyValidationReturn = {
  isKeyCompleted: boolean
  hasSeed: boolean
  hasNoSecret: boolean
  hasLocalSeed: boolean
  isSignatureCompleted: boolean
}

/**
 * Custom hook for key validation logic that was duplicated across components
 * Consolidates validation patterns from SSMultisigKeyControl and SSSignatureDropdown
 */
export function useKeyValidation({
  keyDetails,
  seedDropped,
  decryptedKey,
  signedPsbt
}: UseKeyValidationParams & { signedPsbt?: string }): UseKeyValidationReturn {
  const isKeyCompleted = useMemo(() => {
    return Boolean(
      keyDetails &&
        keyDetails.creationType &&
        ((typeof keyDetails.secret === 'object' &&
          keyDetails.secret.fingerprint &&
          (keyDetails.secret.extendedPublicKey ||
            keyDetails.secret.externalDescriptor ||
            keyDetails.secret.mnemonic)) ||
          (typeof keyDetails.secret === 'string' &&
            keyDetails.secret.length > 0))
    )
  }, [keyDetails])

  const hasSeed = useMemo(() => {
    return Boolean(
      !seedDropped &&
        keyDetails &&
        typeof keyDetails.secret === 'object' &&
        keyDetails.secret.mnemonic
    )
  }, [seedDropped, keyDetails])

  const hasNoSecret = useMemo(() => {
    return Boolean(
      isKeyCompleted &&
        keyDetails &&
        typeof keyDetails.secret === 'object' &&
        !keyDetails.secret.mnemonic
    )
  }, [isKeyCompleted, keyDetails])

  const hasLocalSeed = useMemo(() => {
    return Boolean(
      decryptedKey?.secret &&
        typeof decryptedKey.secret === 'object' &&
        'mnemonic' in decryptedKey.secret &&
        decryptedKey.secret.mnemonic
    )
  }, [decryptedKey])

  const isSignatureCompleted = useMemo(() => {
    return Boolean(signedPsbt && signedPsbt.trim().length > 0)
  }, [signedPsbt])

  return {
    isKeyCompleted,
    hasSeed,
    hasNoSecret,
    hasLocalSeed,
    isSignatureCompleted
  }
}

/**
 * Hook specifically for multisig key control validation
 */
export function useMultisigKeyValidation({
  keyDetails,
  seedDropped
}: UseKeyValidationParams) {
  return useKeyValidation({ keyDetails, seedDropped })
}

/**
 * Hook specifically for signature dropdown validation
 */
export function useSignatureDropdownValidation({
  keyDetails,
  seedDropped,
  decryptedKey,
  signedPsbt
}: UseKeyValidationParams & { signedPsbt?: string }) {
  return useKeyValidation({ keyDetails, seedDropped, decryptedKey, signedPsbt })
}
