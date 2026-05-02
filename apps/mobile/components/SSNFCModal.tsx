import { useCallback, useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
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
  const {
    isEnabled: readerNfcEnabled,
    isHardwareSupported: readerHardware,
    isReading,
    readNFCTag,
    cancelNFCScan
  } = useNFCReader()
  const {
    isEmitting,
    emitNFCTag,
    cancelNFCScan: cancelNFCEmitterScan,
    isEnabled: emitterNfcEnabled,
    isHardwareSupported: emitterHardware
  } = useNFCEmitter()

  const nfcPulseAnim = useSharedValue(0)

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
        // eslint-disable-next-line no-control-regex
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
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`${t('nfc.error.writeFailed')}: ${reason}`)
    }
  }, [isEmitting, cancelNFCEmitterScan, emitNFCTag, dataToWrite, onClose])

  useEffect(() => {
    if (visible) {
      nfcPulseAnim.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1000 }),
            withTiming(0, { duration: 1000 })
          ),
          -1
        )
      )

      return () => {
        cancelAnimation(nfcPulseAnim)
        nfcPulseAnim.set(0)
      }
    }
  }, [visible, nfcPulseAnim])

  const pulseCircleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      nfcPulseAnim.value,
      [0, 1],
      [Colors.gray[800], Colors.gray[400]]
    )
  }))

  const getModeTitle = () =>
    mode === 'read' ? t('nfc.mode.read') : t('nfc.mode.write')

  function getModeDescription() {
    if (mode === 'read') {
      return t('nfc.description.read')
    }
    return t('nfc.description.write')
  }

  function getButtonLabel() {
    if (mode === 'read') {
      return isReading ? t('common.cancel') : t('nfc.button.startReading')
    }
    return isEmitting ? t('common.cancel') : t('nfc.button.startWriting')
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
        <Animated.View style={[styles.nfcCircle, pulseCircleStyle]}>
          <SSText uppercase>
            {isActive
              ? mode === 'read'
                ? t('watchonly.read.scanning')
                : t('nfc.button.writing')
              : getModeTitle()}
          </SSText>
        </Animated.View>
        {mode === 'read' && !readerHardware && (
          <SSText center color="muted" size="sm">
            {t('watchonly.read.nfcNotAvailable')}
          </SSText>
        )}
        {mode === 'write' && !emitterHardware && (
          <SSText center color="muted" size="sm">
            {t('watchonly.read.nfcNotAvailable')}
          </SSText>
        )}
        {mode === 'read' && readerHardware && !readerNfcEnabled && (
          <SSText center color="muted" size="sm">
            {t('watchonly.read.nfcTurnOnInSettings')}
          </SSText>
        )}
        {mode === 'write' && emitterHardware && !emitterNfcEnabled && (
          <SSText center color="muted" size="sm">
            {t('watchonly.read.nfcTurnOnInSettings')}
          </SSText>
        )}
        <SSHStack>
          <SSButton
            label={getButtonLabel()}
            variant={isActive ? 'secondary' : 'default'}
            disabled={mode === 'read' ? !readerHardware : !emitterHardware}
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
    alignItems: 'center',
    borderRadius: 100,
    height: 200,
    justifyContent: 'center',
    width: 200
  }
})

export default SSNFCModal
