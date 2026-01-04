import { Buffer } from 'buffer'
import { setStringAsync } from 'expo-clipboard'
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
import { Colors, Typography } from '@/styles'
import { type Account, type Key } from '@/types/models/Account'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import {
  combinePsbts,
  type TransactionData,
  validateSignedPSBT,
  validateSignedPSBTForCosigner
} from '@/utils/psbt'

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

  const network = useBlockchainStore((state) => state.selectedNetwork)
  const scriptVersion = keyDetails?.scriptVersion || 'P2WSH'

  const { hasLocalSeed, isSignatureCompleted } = useSignatureDropdownValidation(
    {
      keyDetails,
      seedDropped,
      decryptedKey,
      signedPsbt
    }
  )

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
      const collectedSignedPsbts = Array.from(signedPsbts.entries())
        .filter(([, psbt]) => psbt && psbt.trim().length > 0)
        .reduce<Record<number, string>>((acc, [cosignerIndex, psbt]) => {
          acc[cosignerIndex] = psbt
          return acc
        }, {})

      const psbtsToCombine = [
        txBuilderResult.psbt.base64,
        ...Object.values(collectedSignedPsbts)
      ]
      const combinedPsbt = combinePsbts(psbtsToCombine)

      const transactionData: TransactionData = {
        combinedPsbt
      }

      const message = combinedPsbt

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

      if (typeof keyDetails.secret === 'string') {
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

      if (typeof keyDetails.secret === 'object') {
        const secret = keyDetails.secret

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
        } else {
          setExtractedPublicKey('')
        }
      }
    }

    extractPublicKey()
  }, [keyDetails, decryptedKey])

  useEffect(() => {
    if (keyDetails) {
      if (decryptedKey && typeof decryptedKey.secret === 'object') {
        if (decryptedKey.secret.mnemonic) {
          setSeedDropped(false)
        } else {
          setSeedDropped(true)
        }
      } else if (typeof keyDetails.secret === 'object') {
        if (keyDetails.secret.mnemonic) {
          setSeedDropped(false)
        } else {
          setSeedDropped(true)
        }
      } else {
        setSeedDropped(false)
      }
    }
  }, [keyDetails, decryptedKey])

  function getInnerFingerprint(): string | undefined {
    if (decryptedKey && typeof decryptedKey.secret === 'object') {
      return decryptedKey.secret.fingerprint
    }
    if (typeof keyDetails?.secret === 'object') {
      return keyDetails.secret.fingerprint
    }

    return undefined
  }

  const extendedPublicKey =
    extractedPublicKey ||
    (decryptedKey &&
      typeof decryptedKey.secret === 'object' &&
      decryptedKey.secret.extendedPublicKey) ||
    (typeof keyDetails?.secret === 'object' &&
      keyDetails.secret.extendedPublicKey) ||
    ''
  let formattedPubKey = extendedPublicKey
  if (extendedPublicKey && extendedPublicKey.length > 12) {
    formattedPubKey = `${extendedPublicKey.slice(
      0,
      7
    )}...${extendedPublicKey.slice(-4)}`
  }

  useEffect(() => {
    if (signedPsbt && signedPsbt.trim().length > 0) {
      try {
        let psbtToValidate = signedPsbt
        if (signedPsbt.toLowerCase().startsWith('70736274ff')) {
          psbtToValidate = Buffer.from(signedPsbt, 'hex').toString('base64')
        } else if (signedPsbt.startsWith('cHNidP')) {
          psbtToValidate = signedPsbt
        } else {
          if (/^[a-fA-F0-9]+$/.test(signedPsbt) && signedPsbt.length > 100) {
            try {
              psbtToValidate = Buffer.from(signedPsbt, 'hex').toString('base64')
            } catch {
              psbtToValidate = signedPsbt
            }
          }
        }

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

      {isExpanded && (
        <SSVStack style={{ paddingHorizontal: 8, paddingBottom: 8 }} gap="sm">
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
                  setStringAsync(txBuilderResult.psbt.base64)
                  toast(t('common.copiedToClipboard'))
                }
              }}
            />
            <SSButton
              variant="outline"
              disabled={!messageId}
              label={t('common.showQR')}
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
              label={t('common.scanQR')}
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

          <SSButton
            label={t('transaction.preview.fetchFromNip17group')}
            variant="outline"
            onPress={() => {
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
