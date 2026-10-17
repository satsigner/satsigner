import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'
import { type Account } from '@/types/models/Account'
import { isPSBT } from '@/utils/bitcoinContent'

type SSPreviewWatchOnlyActionsProps = {
  account: Account
  isEmitting: boolean
  isReading: boolean
  nfcHardwareSupported: boolean
  serializedPsbt: string
  signedPsbt: string
  transactionId: string
  onCheckSignature: () => void
  onCopy: () => void
  onNFCExport: () => void
  onNFCScan: () => void
  onPaste: () => void
  onScanQR: () => void
  onShowQR: () => void
}

// Watch-only accounts imported from a descriptor or xpub: export the unsigned
// PSBT, then import it back signed.
function SSPreviewWatchOnlyActions({
  account,
  isEmitting,
  isReading,
  nfcHardwareSupported,
  serializedPsbt,
  signedPsbt,
  transactionId,
  onCheckSignature,
  onCopy,
  onNFCExport,
  onNFCScan,
  onPaste,
  onScanQR,
  onShowQR
}: SSPreviewWatchOnlyActionsProps) {
  const creationType = account.keys[0]?.creationType
  const isImportedWatchOnly =
    account.policyType === 'watchonly' &&
    (creationType === 'importDescriptor' ||
      creationType === 'importExtendedPub')
  if (!isImportedWatchOnly) {
    return null
  }

  return (
    <>
      <SSText
        center
        color="muted"
        size="sm"
        uppercase
        style={styles.sectionSpacing}
      >
        {t('transaction.preview.exportUnsigned')}
      </SSText>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          variant="outline"
          disabled={!transactionId}
          label={t('common.copy')}
          style={styles.halfButton}
          onPress={onCopy}
        />
        <SSButton
          variant="outline"
          disabled={!transactionId}
          label={t('transaction.preview.showQR')}
          style={styles.halfButton}
          onPress={onShowQR}
        />
      </SSHStack>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          label={t('transaction.preview.usb')}
          style={styles.halfButton}
          variant="outline"
          disabled
        />
        <SSButton
          label={
            isEmitting
              ? t('watchonly.read.scanning')
              : t('transaction.preview.exportNFC')
          }
          style={styles.halfButton}
          variant="outline"
          disabled={!nfcHardwareSupported || !serializedPsbt}
          onPress={onNFCExport}
        />
      </SSHStack>
      <SSText
        center
        color="muted"
        size="sm"
        uppercase
        style={styles.sectionSpacing}
      >
        {isPSBT(signedPsbt)
          ? t('transaction.preview.importedPsbt')
          : t('transaction.preview.importSigned')}
      </SSText>
      <View style={styles.signedPsbtBox}>
        <ScrollView
          style={styles.signedPsbtScroll}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <SSText style={styles.signedPsbtText}>
            {signedPsbt || t('transaction.preview.signedPsbt')}
          </SSText>
        </ScrollView>
      </View>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          label={t('common.paste')}
          style={styles.halfButton}
          variant="outline"
          onPress={onPaste}
        />
        <SSButton
          label={t('transaction.preview.scanQR')}
          style={styles.halfButton}
          variant="outline"
          onPress={onScanQR}
        />
      </SSHStack>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          label={t('transaction.preview.usb')}
          style={styles.halfButton}
          variant="outline"
          disabled
        />
        <SSButton
          label={
            isReading ? t('watchonly.read.scanning') : t('watchonly.read.nfc')
          }
          style={styles.halfButton}
          variant="outline"
          disabled={!nfcHardwareSupported}
          onPress={onNFCScan}
        />
      </SSHStack>
      <SSButton
        label={t('transaction.preview.checkSignature')}
        style={styles.checkSignatureButton}
        variant="secondary"
        disabled={!signedPsbt}
        onPress={onCheckSignature}
      />
    </>
  )
}

const styles = StyleSheet.create({
  checkSignatureButton: { marginTop: 26 },
  halfButton: { width: '48%' },
  sectionSpacing: { marginTop: 16 },
  signedPsbtBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 600,
    minHeight: 200,
    padding: 12
  },
  signedPsbtScroll: { flex: 1 },
  signedPsbtText: {
    color: Colors.white,
    fontFamily: Typography.sfProMono,
    fontSize: 12,
    lineHeight: 18
  }
})

export default SSPreviewWatchOnlyActions
