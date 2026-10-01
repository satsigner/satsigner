import { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNfcPulse } from '@/hooks/useNfcPulse'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

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

  const pulseCircleStyle = useNfcPulse(visible)

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
        <Animated.View style={pulseCircleStyle}>
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
  }
})

export default SSNFCModal
