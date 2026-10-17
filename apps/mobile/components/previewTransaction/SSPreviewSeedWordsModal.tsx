import { StyleSheet, View } from 'react-native'

import SSModal from '@/components/SSModal'
import SSSeedWordsEntry from '@/components/SSSeedWordsEntry'
import SSText from '@/components/SSText'
import { type useSeedSigning } from '@/hooks/useSeedSigning'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import type { MnemonicWordCount } from '@/types/bips/39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'

type SeedSigning = ReturnType<typeof useSeedSigning>

type SSPreviewSeedWordsModalProps = {
  visible: boolean
  onClose: () => void
  selectedWordCount: MnemonicWordCount
  network: Parameters<typeof appNetworkToBdkNetwork>[0]
  handleMnemonicValid: SeedSigning['handleMnemonicValid']
  handleMnemonicInvalid: SeedSigning['handleMnemonicInvalid']
  handleSeedWordsSubmit: SeedSigning['submitSeedWords']
}

function SSPreviewSeedWordsModal({
  visible,
  onClose,
  selectedWordCount,
  network,
  handleMnemonicValid,
  handleMnemonicInvalid,
  handleSeedWordsSubmit
}: SSPreviewSeedWordsModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <View style={styles.seedWordsModalBody}>
        <SSSeedWordsEntry
          scrollStyle={styles.seedWordsModalScroll}
          contentStyle={styles.seedWordsModalContent}
          wordCount={selectedWordCount}
          wordListName="english"
          network={appNetworkToBdkNetwork(network)}
          onMnemonicValid={handleMnemonicValid}
          onMnemonicInvalid={handleMnemonicInvalid}
          showPassphrase
          showChecksum
          showFingerprint
          showPasteButton
          showScanSeedQRButton
          showActionButton
          actionButtonLabel={t('transaction.preview.signWithSeedWords')}
          actionButtonVariant="secondary"
          onActionButtonPress={handleSeedWordsSubmit}
          actionButtonDisabled={false}
          showCancelButton={false}
          autoCheckClipboard
        >
          <SSVStack gap="lg">
            <SSText center uppercase>
              {t('transaction.preview.enterSeedWords')}
            </SSText>
            <SSText center color="muted" size="sm">
              {t('transaction.preview.enterSeedWordsHint', {
                count: selectedWordCount
              })}
            </SSText>
          </SSVStack>
        </SSSeedWordsEntry>
      </View>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  seedWordsModalBody: {
    flex: 1,
    maxWidth: 400,
    position: 'relative',
    width: '100%'
  },
  seedWordsModalContent: { paddingHorizontal: 16 },
  seedWordsModalScroll: { maxHeight: 600, maxWidth: 400, width: '100%' }
})

export default SSPreviewSeedWordsModal
