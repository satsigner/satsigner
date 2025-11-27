import { useCallback, useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

type SSNFCModalProps = {
  visible: boolean
  onClose: () => void
  onContentRead: (content: string) => void
  mode: 'read' | 'write'
  dataToWrite?: string
}

function SSNFCModal({
  visible,
  onClose,
  onContentRead,
  mode,
  dataToWrite
}: SSNFCModalProps) {
  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()
  const {
    isEmitting,
    emitNFCTag,
    cancelNFCScan: cancelNFCEmitterScan
  } = useNFCEmitter()

  const nfcPulseAnim = useRef(new Animated.Value(0)).current

  const handleNFCRead = useCallback(async () => {
    if (isReading) {
      await cancelNFCScan()
      onClose()
      return
    }

    try {
      const nfcData = await readNFCTag()

      if (!nfcData) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      if (!nfcData.text) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      const text = nfcData.text
        .trim()
        .replace(/[^\S\n]+/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
        .normalize('NFKC')

      onContentRead(text)
      onClose()
      toast.success(t('success.nfcRead'))
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error(t('nfc.error.readFailed'))
      }
    }
  }, [isReading, cancelNFCScan, readNFCTag, onContentRead, onClose])

  const handleNFCWrite = useCallback(async () => {
    if (isEmitting) {
      await cancelNFCEmitterScan()
      onClose()
      return
    }

    if (!dataToWrite) {
      toast.error(t('nfc.error.noDataToWrite'))
      return
    }

    try {
      await emitNFCTag(dataToWrite)
      toast.success(t('success.exportNFC'))
      onClose()
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error(t('nfc.error.writeFailed'))
      }
    }
  }, [isEmitting, cancelNFCEmitterScan, emitNFCTag, dataToWrite, onClose])

  useEffect(() => {
    if (visible) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(nfcPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false
          }),
          Animated.timing(nfcPulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false
          })
        ])
      )

      pulseAnimation.start()

      return () => {
        pulseAnimation.stop()
        nfcPulseAnim.setValue(0)
      }
    }
  }, [visible, nfcPulseAnim])

  const getModeTitle = () => {
    return mode === 'read' ? t('nfc.mode.read') : t('nfc.mode.write')
  }

  function getModeDescription() {
    if (mode === 'read') {
      return t('nfc.description.read')
    } else {
      return t('nfc.description.write')
    }
  }

  function getButtonLabel() {
    if (mode === 'read') {
      return isReading ? t('common.cancel') : t('nfc.button.startReading')
    } else {
      return isEmitting ? t('common.cancel') : t('nfc.button.startWriting')
    }
  }

  function handleButtonPress() {
    if (mode === 'read') {
      handleNFCRead()
    } else {
      handleNFCWrite()
    }
  }

  const isActive = mode === 'read' ? isReading : isEmitting

  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="lg">
        <SSText center style={styles.descriptionText}>
          {getModeDescription()}
        </SSText>
        <Animated.View
          style={[
            styles.nfcCircle,
            {
              backgroundColor: nfcPulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [Colors.gray[800], Colors.gray[400]]
              })
            }
          ]}
        >
          <SSText uppercase>
            {isActive
              ? mode === 'read'
                ? t('watchonly.read.scanning')
                : t('nfc.button.writing')
              : getModeTitle()}
          </SSText>
        </Animated.View>
        {!isAvailable && (
          <SSText center color="muted" size="sm">
            {t('read.nfcNotAvailable')}
          </SSText>
        )}
        <SSHStack>
          <SSButton
            label={getButtonLabel()}
            variant={isActive ? 'secondary' : 'default'}
            disabled={!isAvailable}
            onPress={handleButtonPress}
          />
        </SSHStack>
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  descriptionText: {
    maxWidth: 300
  },
  nfcCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

export default SSNFCModal
