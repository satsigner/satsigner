import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'
import { type Key } from '@/types/models/Account'

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
  onShowQR: () => void
  onNFCExport: () => void
  onPasteFromClipboard: (index: number, psbt: string) => void
  onCameraScan: (index: number) => void
  onNFCScan: (index: number) => void
  onSignWithLocalKey: () => void
}

function SSSignatureDropdown({
  index,
  totalKeys,
  keyDetails,
  messageId,
  txBuilderResult,
  serializedPsbt,
  signedPsbt,
  setSignedPsbt,
  isAvailable,
  isEmitting,
  isReading,
  decryptedKey,
  onShowQR,
  onNFCExport,
  onPasteFromClipboard,
  onCameraScan,
  onNFCScan,
  onSignWithLocalKey
}: SSSignatureDropdownProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)

  // Check if this cosigner has a seed - show Sign with Local Key button at the end
  const hasLocalSeed = Boolean(
    decryptedKey?.secret &&
      typeof decryptedKey.secret === 'object' &&
      'mnemonic' in decryptedKey.secret &&
      decryptedKey.secret.mnemonic
  )

  return (
    <View
      style={[
        {
          borderColor: '#6A6A6A',
          borderTopWidth: 2,
          backgroundColor: index % 2 === 1 ? 'black' : '#1E1E1E'
        },
        index === totalKeys - 1 && {
          borderBottomWidth: 2
        }
      ]}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        disabled={!messageId}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 8,
          opacity: messageId ? 1 : 0.5
        }}
      >
        <SSHStack justifyBetween style={{ alignItems: 'center' }}>
          <SSHStack style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#4A4A4A',
                marginRight: 8
              }}
            />
            <SSText color="muted" size="lg">
              {t('transaction.preview.signature')} {index + 1}
            </SSText>
          </SSHStack>
        </SSHStack>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <SSVStack style={{ paddingHorizontal: 8, paddingBottom: 8 }} gap="sm">
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
              minHeight: 100,
              maxHeight: 300,
              paddingTop: 12,
              paddingBottom: 12,
              paddingHorizontal: 12,
              backgroundColor: Colors.gray[900],
              borderRadius: 8,
              borderWidth: 1,
              borderColor: Colors.gray[700]
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

          {/* Check if this cosigner has a seed - show Sign with Local Key button at the end */}
          {hasLocalSeed && (
            <SSButton
              label={t('transaction.preview.signWithLocalKey')}
              onPress={() => {
                onSignWithLocalKey()
              }}
              variant="secondary"
              style={{ marginTop: 16 }}
            />
          )}
        </SSVStack>
      )}
    </View>
  )
}

export default SSSignatureDropdown
