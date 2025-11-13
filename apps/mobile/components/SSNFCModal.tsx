import { useCallback, useEffect, useRef } from 'react'
import { Animated } from 'react-native'
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
  dataToWrite?: string // for write mode
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

  // Animation for NFC pulsating effect
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

      // Sanitize NFC data
      const text = nfcData.text
        .trim()
        .replace(/[^\S\n]+/g, '') // Remove all whitespace except newlines
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and other invisible characters
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '') // Remove control characters except \n
        .normalize('NFKC') // Normalize unicode characters

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

  // NFC pulsating animation effect
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

  const getModeDescription = () => {
    if (mode === 'read') {
      return t('nfc.description.read')
    } else {
      return t('nfc.description.write')
    }
  }

  const getButtonLabel = () => {
    if (mode === 'read') {
      return isReading ? t('common.cancel') : t('nfc.button.startReading')
    } else {
      return isEmitting ? t('common.cancel') : t('nfc.button.startWriting')
    }
  }

  const handleButtonPress = () => {
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
        <SSText center style={{ maxWidth: 300 }}>
          {getModeDescription()}
        </SSText>

        <Animated.View
          style={{
            width: 200,
            height: 200,
            backgroundColor: nfcPulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [Colors.gray[800], Colors.gray[400]]
            }),
            borderRadius: 100,
            justifyContent: 'center',
            alignItems: 'center'
          }}
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

export default SSNFCModal
