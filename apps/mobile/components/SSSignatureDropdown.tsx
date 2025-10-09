import { Buffer } from 'buffer'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'

import { SSIconCircleX, SSIconGreen } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { useKeySourceLabel } from '@/hooks/useKeySourceLabel'
import { useSignatureDropdownValidation } from '@/hooks/useKeyValidation'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { useNostrStore } from '@/store/nostr'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Typography } from '@/styles'
import { type Account, type Key } from '@/types/models/Account'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import {
  storeTransactionData,
  type TransactionData
} from '@/utils/psbtAccountMatcher'
import {
  validateSignedPSBT,
  validateSignedPSBTForCosigner
} from '@/utils/psbtValidator'

type SSSignatureDropdownProps = {
  index: number
  totalKeys: number
  keyDetails: Key
  messageId: string
  txBuilderResult: any
  serializedPsbt: string
  signedPsbt: string
  setSignedPsbt: (psbt: string) => void
  isAvailable: boolean
  isEmitting: boolean
  isReading: boolean
  decryptedKey?: Key
  account: Account
  accountId: string
  signedPsbts: Map<number, string>
  onShowQR: () => void
  onNFCExport: () => void
  onPasteFromClipboard: (index: number, psbt: string) => void
  onCameraScan: (index: number) => void
  onNFCScan: (index: number) => void
  onSignWithLocalKey: () => void
  onSignWithSeedQR: () => void
  onSignWithSeedWords: () => void
  validationResult?: boolean
}

function SSSignatureDropdown({
  index,
  totalKeys,
  keyDetails,
  messageId,
  txBuilderResult,
  serializedPsbt,
  signedPsbt,
  isAvailable,
  isEmitting,
  isReading,
  decryptedKey,
  account,
  accountId,
  signedPsbts,
  onShowQR,
  onNFCExport,
  onPasteFromClipboard,
  onCameraScan,
  onNFCScan,
  onSignWithLocalKey,
  onSignWithSeedQR,
  onSignWithSeedWords,
  validationResult
}: SSSignatureDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPsbtValid, setIsPsbtValid] = useState<boolean | null>(null)
  const [extractedPublicKey, setExtractedPublicKey] = useState('')
  const [seedDropped, setSeedDropped] = useState(false)

  const router = useRouter()
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )

  // Get network and script version for source label
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const scriptVersion = keyDetails?.scriptVersion || 'P2WSH'

  // Use custom hooks for validation and label generation
  const { hasLocalSeed, isSignatureCompleted } = useSignatureDropdownValidation(
    {
      keyDetails,
      seedDropped,
      decryptedKey,
      signedPsbt
    }
  )

  // Function to send transaction data via Nostr
  const handleSendTransactionToGroup = useCallback(async () => {
    if (!account?.nostr?.autoSync) {
      toast.error(t('account.nostrSync.autoSyncMustBeEnabled'))
      return
    }

    if (!messageId || !txBuilderResult?.psbt?.base64) {
      toast.error(t('account.nostrSync.transactionDataNotAvailable'))
      return
    }

    try {
      // Collect all signed PSBTs with their cosigner indices
      const collectedSignedPsbts = Array.from(signedPsbts.entries())
        .filter(([, psbt]) => psbt && psbt.trim().length > 0)
        .reduce(
          (acc, [cosignerIndex, psbt]) => {
            acc[cosignerIndex] = psbt
            return acc
          },
          {} as Record<number, string>
        )

      const transactionData: TransactionData = {
        network: account.network === 'bitcoin' ? 'mainnet' : account.network,
        keyCount: account.keyCount || account.keys?.length || 0,
        keysRequired: account.keysRequired || 1,
        originalPsbt: txBuilderResult.psbt.base64,
        signedPsbts: collectedSignedPsbts,
        timestamp: Date.now(),
        rbf: useTransactionBuilderStore.getState().rbf
      }

      storeTransactionData(transactionData)

      const message = `🔐 Multisig Transaction Ready for Signing

        Network: ${account.network}
        Required Signatures: ${account.keysRequired}/${account.keyCount}
        Current Signatures: ${Object.keys(collectedSignedPsbts).length}

        Transaction Data (PSBT-based):
        ${JSON.stringify(transactionData, null, 2)}
        [${t('account.transaction.signFlow')}]`

      setTransactionToShare({
        message,
        transactionData
      })

      router.push({
        pathname: `/account/${accountId}/settings/nostr/devicesGroupChat`
      })
    } catch {
      toast.error(t('account.nostrSync.failedToSendTransactionData'))
    }
  }, [
    account,
    messageId,
    txBuilderResult,
    signedPsbts,
    router,
    accountId,
    setTransactionToShare
  ])

  const { sourceLabel } = useKeySourceLabel({
    keyDetails,
    scriptVersion,
    network,
    seedDropped,
    decryptedKey
  })

  // Extract public key from descriptor when key details change
  useEffect(() => {
    async function extractPublicKey() {
      if (!keyDetails) {
        setExtractedPublicKey('')
        return
      }

      // In signing context, secret is encrypted (string), so we can't extract public key directly
      // We need to use the decryptedKey prop instead
      if (typeof keyDetails.secret === 'string') {
        // Use decryptedKey if available
        if (decryptedKey && typeof decryptedKey.secret === 'object') {
          const secret = decryptedKey.secret
          if (secret.extendedPublicKey) {
            setExtractedPublicKey(secret.extendedPublicKey)
            return
          }
          if (secret.externalDescriptor) {
            try {
              const publicKey = getExtendedKeyFromDescriptor(
                secret.externalDescriptor
              )
              setExtractedPublicKey(publicKey)
            } catch {
              setExtractedPublicKey('')
            }
          }
        }
        setExtractedPublicKey('')
        return
      }

      // Handle object secret (shouldn't happen in signing context, but just in case)
      if (typeof keyDetails.secret === 'object') {
        const secret = keyDetails.secret

        // If we already have an extended public key, use it
        if (secret.extendedPublicKey) {
          setExtractedPublicKey(secret.extendedPublicKey)
          return
        }

        // If we have a descriptor, extract the public key from it
        if (secret.externalDescriptor) {
          try {
            const publicKey = getExtendedKeyFromDescriptor(
              secret.externalDescriptor
            )
            setExtractedPublicKey(publicKey)
          } catch {
            setExtractedPublicKey('')
          }
        } else {
          setExtractedPublicKey('')
        }
      }
    }

    extractPublicKey()
  }, [keyDetails, decryptedKey])

  // Reset seedDropped when keyDetails changes
  useEffect(() => {
    if (keyDetails) {
      // In signing context, use decryptedKey to check for mnemonic
      if (decryptedKey && typeof decryptedKey.secret === 'object') {
        // If the key has a mnemonic, reset seedDropped to false
        if (decryptedKey.secret.mnemonic) {
          setSeedDropped(false)
        } else {
          setSeedDropped(true)
        }
      } else if (typeof keyDetails.secret === 'object') {
        // Fallback for object secret (shouldn't happen in signing context)
        if (keyDetails.secret.mnemonic) {
          setSeedDropped(false)
        } else {
          setSeedDropped(true)
        }
      } else {
        // For encrypted secrets, we can't determine if mnemonic exists
        setSeedDropped(false)
      }
    }
  }, [keyDetails, decryptedKey])

  // Helper function to get the inner fingerprint from secret
  function getInnerFingerprint(): string | undefined {
    // First try to get from decryptedKey (for signing context)
    if (decryptedKey && typeof decryptedKey.secret === 'object') {
      return decryptedKey.secret.fingerprint
    }

    // Fallback to keyDetails.secret if it's an object
    if (typeof keyDetails?.secret === 'object') {
      return keyDetails.secret.fingerprint
    }

    return undefined
  }

  // Use the extracted public key from state, or fall back to direct access
  const extendedPublicKey =
    extractedPublicKey ||
    (decryptedKey &&
      typeof decryptedKey.secret === 'object' &&
      decryptedKey.secret.extendedPublicKey) ||
    (typeof keyDetails?.secret === 'object' &&
      keyDetails.secret.extendedPublicKey) ||
    ''

  // Format public key for display: first 7, last 4 chars
  let formattedPubKey = extendedPublicKey
  if (extendedPublicKey && extendedPublicKey.length > 12) {
    formattedPubKey = `${extendedPublicKey.slice(
      0,
      7
    )}...${extendedPublicKey.slice(-4)}`
  }

  // Validate PSBT when signedPsbt changes
  useEffect(() => {
    if (signedPsbt && signedPsbt.trim().length > 0) {
      try {
        // Convert hex PSBT to base64 if needed
        let psbtToValidate = signedPsbt
        if (signedPsbt.toLowerCase().startsWith('70736274ff')) {
          // This is a hex PSBT, convert to base64
          psbtToValidate = Buffer.from(signedPsbt, 'hex').toString('base64')
        } else if (signedPsbt.startsWith('cHNidP')) {
          // This is already base64 PSBT, use as-is
          psbtToValidate = signedPsbt
        } else {
          // Try to detect if it's a valid hex string
          if (/^[a-fA-F0-9]+$/.test(signedPsbt) && signedPsbt.length > 100) {
            // Likely a hex PSBT, try to convert
            try {
              psbtToValidate = Buffer.from(signedPsbt, 'hex').toString('base64')
            } catch {
              // If conversion fails, use original
              psbtToValidate = signedPsbt
            }
          }
        }

        // Use cosigner-specific validation for multisig accounts
        const isValid =
          account.policyType === 'multisig'
            ? validateSignedPSBTForCosigner(
                psbtToValidate,
                account,
                index,
                decryptedKey
              )
            : validateSignedPSBT(psbtToValidate, account)
        setIsPsbtValid(isValid)
      } catch {
        setIsPsbtValid(false)
      }
    } else {
      setIsPsbtValid(null)
    }
  }, [signedPsbt, account, index, decryptedKey])

  return (
    <View
      style={[styles.container, index === totalKeys - 1 && styles.lastItem]}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        disabled={!messageId}
        style={[styles.header, !messageId && styles.headerDisabled]}
      >
        <SSHStack justifyBetween>
          <SSHStack style={{ alignItems: 'center' }} gap="sm">
            {isSignatureCompleted ? (
              validationResult === true ? (
                <SSIconGreen width={24} height={24} />
              ) : validationResult === false ? (
                <SSIconCircleX width={24} height={24} stroke="#FF6B6B" />
              ) : (
                <SSIconGreen width={24} height={24} />
              )
            ) : (
              <View style={styles.signatureIcon} />
            )}
            <SSText color="muted" size="lg" style={{ paddingHorizontal: 10 }}>
              {t('common.key')} {index + 1}
            </SSText>
            <SSVStack gap="none">
              <SSText color="muted">{sourceLabel}</SSText>
              <SSText color={keyDetails?.name ? 'white' : 'muted'}>
                {keyDetails?.name ?? t('account.seed.noLabel')}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSVStack gap="none" style={{ alignItems: 'flex-end' }}>
            <SSText color={getInnerFingerprint() ? 'white' : 'muted'}>
              {getInnerFingerprint() || t('account.fingerprint')}
            </SSText>
            <SSText
              color={extendedPublicKey ? 'white' : 'muted'}
              selectable
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {formattedPubKey || t('account.seed.publicKey')}
            </SSText>
          </SSVStack>
        </SSHStack>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <SSVStack style={{ paddingHorizontal: 8, paddingBottom: 8 }} gap="sm">
          {/* Check if this cosigner has a seed - show Sign with Local Key button at the top */}
          {hasLocalSeed ? (
            <SSButton
              label={t('transaction.preview.signWithLocalKey')}
              onPress={() => {
                onSignWithLocalKey()
              }}
              variant="secondary"
              style={{ marginTop: 16 }}
            />
          ) : (
            <SSVStack gap="sm" style={{ marginTop: 16 }}>
              <SSButton
                label={t('transaction.preview.SignWithSeedQR')}
                onPress={() => {
                  onSignWithSeedQR()
                }}
                variant="secondary"
              />
              <SSButton
                label={t('transaction.preview.signWithSeedWords')}
                onPress={() => {
                  onSignWithSeedWords()
                }}
                variant="secondary"
              />
            </SSVStack>
          )}
          <SSText
            center
            color="muted"
            size="sm"
            uppercase
            style={{ marginTop: 16 }}
          >
            {t('transaction.preview.exportUnsigned')}
          </SSText>
          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              variant="outline"
              disabled={!messageId}
              label={t('common.copy')}
              style={{ width: '48%' }}
              onPress={() => {
                if (txBuilderResult?.psbt?.base64) {
                  // Import Clipboard from expo-clipboard
                  const { setStringAsync } = require('expo-clipboard')
                  setStringAsync(txBuilderResult.psbt.base64)
                  toast(t('common.copiedToClipboard'))
                }
              }}
            />
            <SSButton
              variant="outline"
              disabled={!messageId}
              label={t('transaction.preview.showQR')}
              style={{ width: '48%' }}
              onPress={() => {
                onShowQR()
              }}
            />
          </SSHStack>
          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              label={t('common.usb')}
              style={{ width: '48%' }}
              variant="outline"
              disabled
            />
            <SSButton
              label={
                isEmitting
                  ? t('watchonly.read.scanning')
                  : t('transaction.preview.exportNFC')
              }
              style={{ width: '48%' }}
              variant="outline"
              disabled={!isAvailable || !serializedPsbt}
              onPress={() => {
                onNFCExport()
              }}
            />
          </SSHStack>
          <SSButton
            label={t('transaction.preview.nip17group')}
            variant="outline"
            disabled={!messageId || !account?.nostr?.autoSync}
            onPress={handleSendTransactionToGroup}
          />
          <SSText
            center
            color="muted"
            size="sm"
            uppercase
            style={{ marginTop: 16 }}
          >
            {t('transaction.preview.importSigned')}
          </SSText>

          {/* Imported PSBT Display Area - Placed BEFORE import buttons like watch-only wallet */}
          <View
            style={[
              styles.psbtDisplay,
              {
                borderColor: signedPsbt
                  ? isPsbtValid
                    ? Colors.mainGreen
                    : Colors.mainRed
                  : Colors.gray[700]
              }
            ]}
          >
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              <SSText style={styles.psbtText}>
                {signedPsbt || t('transaction.preview.signedPsbt')}
              </SSText>
            </ScrollView>
          </View>

          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              label={t('common.paste')}
              style={{ width: '48%' }}
              variant="outline"
              onPress={() => {
                onPasteFromClipboard(index, '')
              }}
            />
            <SSButton
              label={t('transaction.preview.showQR')}
              style={{ width: '48%' }}
              variant="outline"
              onPress={() => {
                onCameraScan(index)
              }}
            />
          </SSHStack>
          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              label={t('common.usb')}
              style={{ width: '48%' }}
              variant="outline"
              disabled
            />
            <SSButton
              label={
                isReading
                  ? t('watchonly.read.scanning')
                  : t('watchonly.read.nfc')
              }
              style={{ width: '48%' }}
              variant="outline"
              disabled={!isAvailable}
              onPress={() => {
                onNFCScan(index)
              }}
            />
          </SSHStack>

          {/* NIP-17 GROUP Import */}
          <SSButton
            label={t('transaction.preview.fetchFromNip17group')}
            variant="outline"
            onPress={() => {
              // TODO: Implement NIP-17 GROUP import
              toast.info(t('transaction.preview.nip17groupComingSoon'))
            }}
          />
        </SSVStack>
      )}
    </View>
  )
}
export default SSSignatureDropdown

const styles = {
  container: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: Colors.gray[700]
  },
  lastItem: {
    borderBottomWidth: 1
  },
  header: {
    paddingVertical: 8
  },
  headerDisabled: {
    opacity: 0.5
  },
  signatureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray[800]
  },
  psbtDisplay: {
    minHeight: 200,
    maxHeight: 600,
    padding: 12,
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    borderWidth: 1
  },
  psbtText: {
    fontFamily: Typography.sfProMono,
    fontSize: 12,
    color: Colors.white,
    lineHeight: 18
  }
}
