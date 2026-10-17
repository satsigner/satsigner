import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'

import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { type useNfcPulse } from '@/hooks/useNfcPulse'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSPreviewNfcModalProps = {
  errorKey: string | null
  onClose: () => void
  pulseStyle: ReturnType<typeof useNfcPulse>
  statusLabel: string
  visible: boolean
}

// NFC transfer in progress: a pulsing status, or the error that stopped it.
function SSPreviewNfcModal({
  errorKey,
  onClose,
  pulseStyle,
  statusLabel,
  visible
}: SSPreviewNfcModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="lg">
        <SSText center style={styles.nfcTitle}>
          {errorKey ? t('common.errorTitle') : t('transaction.preview.nfcTip')}
        </SSText>
        {errorKey ? (
          <SSText color="white" center>
            {t(errorKey)}
          </SSText>
        ) : (
          <Animated.View style={pulseStyle}>
            <SSText uppercase>{statusLabel}</SSText>
          </Animated.View>
        )}
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  nfcTitle: { maxWidth: 300 }
})

export default SSPreviewNfcModal
