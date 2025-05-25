import { StyleSheet, View } from 'react-native'

import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { encodeStandardSeedQR } from '@/utils/seedqr'

type SSSeedQRProps = {
  mnemonic: string
  visible: boolean
  onClose: () => void
}

export default function SSSeedQR({
  mnemonic,
  visible,
  onClose
}: SSSeedQRProps) {
  // Format mnemonic by trimming whitespace and ensuring single spaces between words
  const formattedMnemonic = mnemonic.trim().replace(/\s+/g, ' ')

  // Only encode if we have a valid mnemonic
  const qrValue = formattedMnemonic
    ? encodeStandardSeedQR(formattedMnemonic)
    : ''

  const qrSize = formattedMnemonic.split(' ').length === 12 ? 250 : 300

  return (
    <SSModal
      visible={visible}
      fullOpacity
      onClose={onClose}
      closeButtonVariant="ghost"
      label={t('common.close')}
    >
      <SSVStack gap="lg" style={styles.container}>
        <SSText center uppercase>
          {t('account.seedqr.title')}
        </SSText>
        {formattedMnemonic ? (
          <>
            <View style={styles.qrContainer}>
              <SSQRCode
                value={qrValue}
                size={qrSize}
                color={Colors.black}
                backgroundColor={Colors.white}
              />
            </View>
            <View style={styles.dataContainer}>
              <SSText center color="muted" size="sm" style={styles.dataText}>
                {qrValue}
              </SSText>
            </View>
            <SSText center color="muted" size="sm">
              {t('account.seedqr.standardDescription')}
            </SSText>
          </>
        ) : (
          <SSText center color="muted">
            {t('account.seedqr.title')}
          </SSText>
        )}
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center'
  },
  qrContainer: {
    padding: 10,
    backgroundColor: Colors.white,
    borderRadius: 8
  },
  dataContainer: {
    width: '100%',
    padding: 10,
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    marginTop: 10
  },
  dataText: {
    fontFamily: 'SF Mono'
  }
})
