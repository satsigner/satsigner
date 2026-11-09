import { StyleSheet, View } from 'react-native'

import {
  NOSTR_KEY_LINE_BREAK_EVERY,
  NOSTR_KEY_QR_SIZE
} from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSModal from './SSModal'
import SSShadedKeyText from './SSShadedKeyText'
import SSShareableQR from './SSShareableQR'
import SSText from './SSText'

type SSNostrKeyQRModalProps = {
  value: string
  label: string
  shareable: boolean
  visible: boolean
  onClose: () => void
}

function SSNostrKeyQRModal({
  value,
  label,
  shareable,
  visible,
  onClose
}: SSNostrKeyQRModalProps) {
  return (
    <SSModal
      visible={visible}
      fullOpacity
      onClose={onClose}
      label={t('common.cancel')}
    >
      <SSVStack gap="lg" style={styles.content}>
        <SSText center uppercase>
          {label}
        </SSText>
        <SSShareableQR
          value={value}
          size={NOSTR_KEY_QR_SIZE}
          color={Colors.white}
          backgroundColor={Colors.gray[950]}
          ecl="H"
          containerStyle={styles.qrCodeWrapper}
          hideShareButton={!shareable}
        >
          <View style={styles.dataBox}>
            <SSShadedKeyText
              value={value}
              size="sm"
              lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
            />
          </View>
        </SSShareableQR>
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 16
  },
  dataBox: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    maxWidth: '100%',
    padding: 12
  },
  qrCodeWrapper: {
    backgroundColor: Colors.gray[950],
    borderRadius: 10,
    padding: 16
  }
})

export default SSNostrKeyQRModal
