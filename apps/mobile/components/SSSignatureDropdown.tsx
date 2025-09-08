import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'
import { Buffer } from 'buffer'

import { SSIconGreen } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Typography } from '@/styles'
import { type Account, type Key } from '@/types/models/Account'
import {
  validateSignedPSBT,
  validateSignedPSBTForCosigner
} from '@/utils/psbtValidator'
import { getKeyFormatForScriptVersion } from '@/utils/bitcoin'
import { extractExtendedKeyFromDescriptor } from '@/api/bdk'
import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'

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
  onShowQR: () => void
  onNFCExport: () => void
  onPasteFromClipboard: (index: number, psbt: string) => void
  onCameraScan: (index: number) => void
  onNFCScan: (index: number) => void
  onSignWithLocalKey: () => void
  onSignWithSeedQR: () => void
  onSignWithSeedWords: () => void
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
  onShowQR,
  onNFCExport,
  onPasteFromClipboard,
  onCameraScan,
  onNFCScan,
  onSignWithLocalKey,
  onSignWithSeedQR,
  onSignWithSeedWords
}: SSSignatureDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPsbtValid, setIsPsbtValid] = useState<boolean | null>(null)
  const [extractedPublicKey, setExtractedPublicKey] = useState('')
  const [seedDropped, setSeedDropped] = useState(false)

  // Check if this cosigner has a seed - show Sign with Local Key button at the end
  const hasLocalSeed = Boolean(
    decryptedKey?.secret &&
      typeof decryptedKey.secret === 'object' &&
      'mnemonic' in decryptedKey.secret &&
      decryptedKey.secret.mnemonic
  )

  // Check if this cosigner has completed their signature
  const isSignatureCompleted = Boolean(
    signedPsbt && signedPsbt.trim().length > 0
  )

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
              const network = useBlockchainStore.getState().selectedNetwork
              const descriptor = await new Descriptor().create(
                secret.externalDescriptor,
                network as Network
              )
              const publicKey =
                await extractExtendedKeyFromDescriptor(descriptor)
              setExtractedPublicKey(publicKey)
            } catch (_error) {
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
            const network = useBlockchainStore.getState().selectedNetwork
            const descriptor = await new Descriptor().create(
              secret.externalDescriptor,
              network as Network
            )
            const publicKey = await extractExtendedKeyFromDescriptor(descriptor)
            setExtractedPublicKey(publicKey)
          } catch (_error) {
            setExtractedPublicKey('')
          }
        } else {
          setExtractedPublicKey('')
        }
      }
    }

    extractPublicKey()
  }, [keyDetails])

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

  // Get network and script version for source label
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const scriptVersion = keyDetails?.scriptVersion || 'P2WSH'

  function getSourceLabel() {
    if (!keyDetails) {
      return t('account.selectKeySource')
    } else if (keyDetails.creationType === 'generateMnemonic') {
      // Check if seed has been dropped
      if (
        seedDropped ||
        (decryptedKey &&
          typeof decryptedKey.secret === 'object' &&
          !decryptedKey.secret.mnemonic) ||
        (typeof keyDetails.secret === 'object' && !keyDetails.secret.mnemonic)
      ) {
        return t('account.seed.droppedSeed', {
          name: keyDetails.scriptVersion
        })
      }
      return t('account.seed.newSeed', {
        name: keyDetails.scriptVersion
      })
    } else if (keyDetails.creationType === 'importMnemonic') {
      // Check if seed has been dropped
      if (
        seedDropped ||
        (decryptedKey &&
          typeof decryptedKey.secret === 'object' &&
          !decryptedKey.secret.mnemonic) ||
        (typeof keyDetails.secret === 'object' && !keyDetails.secret.mnemonic)
      ) {
        return t('account.seed.droppedSeed', {
          name: keyDetails.scriptVersion
        })
      }
      return t('account.seed.importedSeed', { name: keyDetails.scriptVersion })
    } else if (keyDetails.creationType === 'importDescriptor') {
      return t('account.seed.external')
    } else if (keyDetails.creationType === 'importExtendedPub') {
      // Show the correct label according to the script version and network
      const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
      return t(`account.import.${keyFormat}`)
    }
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
            } catch (_error) {
              // If conversion fails, use original
              psbtToValidate = signedPsbt
            }
          }
        }

        // Use cosigner-specific validation for multisig accounts
        const isValid =
          account.policyType === 'multisig'
            ? validateSignedPSBTForCosigner(psbtToValidate, account, index)
            : validateSignedPSBT(psbtToValidate, account)
        setIsPsbtValid(isValid)
      } catch (_error) {
        setIsPsbtValid(false)
      }
    } else {
      setIsPsbtValid(null)
    }
  }, [signedPsbt, account])

  return (
    <View
      style={[
        {
          borderColor: '#444444',
          paddingBottom: 16,
          paddingTop: 16,
          borderTopWidth: 1
        },
        index === totalKeys - 1 && { borderBottomWidth: 1 }
      ]}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        disabled={!messageId}
        style={{
          paddingBottom: 8,
          paddingTop: 8,
          opacity: messageId ? 1 : 0.5
        }}
      >
        <SSHStack justifyBetween>
          <SSHStack style={{ alignItems: 'center' }} gap="sm">
            {isSignatureCompleted ? (
              <SSIconGreen width={24} height={24} />
            ) : (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#4A4A4A'
                }}
              />
            )}
            <SSText color="muted" size="lg" style={{ paddingHorizontal: 10 }}>
              {t('common.key')} {index + 1}
            </SSText>
            <SSVStack gap="none">
              <SSText color="muted">{getSourceLabel()}</SSText>
              <SSText color={keyDetails?.name ? 'white' : 'muted'}>
                {keyDetails?.name ?? t('account.seed.noLabel')}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSVStack gap="none" style={{ alignItems: 'flex-end' }}>
            <SSText color={keyDetails?.fingerprint ? 'white' : 'muted'}>
              {keyDetails?.fingerprint || t('account.fingerprint')}
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
                label="Sign with Seed Words"
                onPress={() => {
                  onSignWithSeedWords()
                }}
                variant="secondary"
              />
            </SSVStack>
          )}

          {/* Export for external signing */}
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
              label="Show QR"
              style={{ width: '48%' }}
              onPress={() => {
                onShowQR()
              }}
            />
          </SSHStack>
          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              label="USB"
              style={{ width: '48%' }}
              variant="outline"
              disabled
            />
            <SSButton
              label={isEmitting ? t('watchonly.read.scanning') : 'Export NFC'}
              style={{ width: '48%' }}
              variant="outline"
              disabled={!isAvailable || !serializedPsbt}
              onPress={() => {
                onNFCExport()
              }}
            />
          </SSHStack>

          {/* NIP-17 GROUP Export */}
          <SSButton
            label="NIP-17 GROUP"
            variant="outline"
            disabled={!messageId}
            onPress={() => {
              // TODO: Implement NIP-17 GROUP export
              toast.info('NIP-17 GROUP export coming soon')
            }}
          />

          {/* Import signed PSBT */}
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
            style={{
              minHeight: 200,
              maxHeight: 600,
              paddingTop: 12,
              paddingBottom: 12,
              paddingHorizontal: 12,
              backgroundColor: Colors.gray[900],
              borderRadius: 8,
              borderWidth: 1,
              borderColor: signedPsbt
                ? isPsbtValid
                  ? Colors.mainGreen
                  : Colors.mainRed
                : Colors.gray[700]
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              <SSText
                style={{
                  fontFamily: Typography.sfProMono,
                  fontSize: 12,
                  color: Colors.white,
                  lineHeight: 18
                }}
              >
                {signedPsbt || t('transaction.preview.signedPsbt')}
              </SSText>
            </ScrollView>
          </View>

          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              label="Paste"
              style={{ width: '48%' }}
              variant="outline"
              onPress={() => {
                onPasteFromClipboard(index, '')
              }}
            />
            <SSButton
              label="Scan QR"
              style={{ width: '48%' }}
              variant="outline"
              onPress={() => {
                onCameraScan(index)
              }}
            />
          </SSHStack>
          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              label="USB"
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
            label="FETCH FROM NIP-17 GROUP"
            variant="outline"
            onPress={() => {
              // TODO: Implement NIP-17 GROUP import
              toast.info('NIP-17 GROUP import coming soon')
            }}
          />
        </SSVStack>
      )}
    </View>
  )
}
export default SSSignatureDropdown
