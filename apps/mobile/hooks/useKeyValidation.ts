import { useMemo } from 'react'

import type { Key } from '@/types/models/Account'

interface UseKeyValidationParams {
  keyDetails: Key | undefined
  seedDropped: boolean
  decryptedKey?: Key
}

interface UseKeyValidationReturn {
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
  const isKeyCompleted = useMemo(
    () =>
      Boolean(
        keyDetails &&
        keyDetails.creationType &&
        ((typeof keyDetails.secret === 'object' &&
          keyDetails.secret.fingerprint &&
          (keyDetails.secret.extendedPublicKey ||
            keyDetails.secret.externalDescriptor ||
            keyDetails.secret.mnemonic)) ||
          (typeof keyDetails.secret === 'string' &&
            keyDetails.secret.length > 0))
      ),
    [keyDetails]
  )

  const hasSeed = useMemo(
    () =>
      Boolean(
        !seedDropped &&
        keyDetails &&
        typeof keyDetails.secret === 'object' &&
        keyDetails.secret.mnemonic
      ),
    [seedDropped, keyDetails]
  )

  const hasNoSecret = useMemo(
    () =>
      Boolean(
        isKeyCompleted &&
        keyDetails &&
        typeof keyDetails.secret === 'object' &&
        !keyDetails.secret.mnemonic
      ),
    [isKeyCompleted, keyDetails]
  )

  const hasLocalSeed = useMemo(
    () =>
      Boolean(
        decryptedKey?.secret &&
        typeof decryptedKey.secret === 'object' &&
        'mnemonic' in decryptedKey.secret &&
        decryptedKey.secret.mnemonic
      ),
    [decryptedKey]
  )

  const isSignatureCompleted = useMemo(
    () => Boolean(signedPsbt && signedPsbt.trim().length > 0),
    [signedPsbt]
  )

  return {
    hasLocalSeed,
    hasNoSecret,
    hasSeed,
    isKeyCompleted,
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
  const baseValidation = useKeyValidation({ keyDetails, seedDropped })

  // Override hasSeed logic to properly handle watch-only keys
  const hasSeed = useMemo(() => {
    // Watch-only keys (tpub/xpub, descriptor) should never have seeds
    if (
      keyDetails?.creationType === 'importExtendedPub' ||
      keyDetails?.creationType === 'importDescriptor'
    ) {
      return false
    }

    // For other key types, use the base validation logic
    return baseValidation.hasSeed
  }, [keyDetails?.creationType, baseValidation.hasSeed])

  return {
    ...baseValidation,
    hasSeed
  }
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
  return useKeyValidation({ decryptedKey, keyDetails, seedDropped, signedPsbt })
}
