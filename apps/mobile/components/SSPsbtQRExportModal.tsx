import { StyleSheet, useWindowDimensions } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSShareableQR from '@/components/SSShareableQR'
import SSText from '@/components/SSText'
import {
  ANIMATION_SPEED_MAX,
  ANIMATION_SPEED_MIN,
  QR_COMPLEXITY_MAX,
  QR_COMPLEXITY_MIN,
  QR_VALUE_PREVIEW_LENGTH,
  QRDisplayMode
} from '@/constants/qr'
import { usePsbtQrExport } from '@/hooks/usePsbtQrExport'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

const QR_SIZE_WIDTH_RATIO = 0.9
const QR_SIZE_HEIGHT_RATIO = 0.5
const QR_SIZE_MAX = 700
const QR_TRACK_WIDTH_RATIO = 0.92
const MODAL_PADDING_RATIO = 0.05
const QR_FRAME_PADDING = 5

const DISPLAY_MODE_TABS = {
  primary: { key: QRDisplayMode.RAW, label: 'RAW' },
  secondary: { key: QRDisplayMode.UR, label: 'UR' },
  tertiary: { key: QRDisplayMode.BBQR, label: 'BBQR' }
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  qrFrame: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 2,
    marginBottom: 0,
    padding: QR_FRAME_PADDING
  },
  qrValuePreview: {
    backgroundColor: Colors.gray[900],
    borderRadius: 2,
    height: 80,
    padding: 5,
    paddingHorizontal: 20,
    textAlignVertical: 'center'
  },
  statusText: { marginTop: 16 },
  stepButton: { height: 50, width: 50 },
  stepButtons: { justifyContent: 'center' },
  title: { marginBottom: 5 }
})

type SSPsbtQRExportModalProps = {
  visible: boolean
  onClose: () => void
  psbtBase64: string | undefined
  initialDisplayMode?: QRDisplayMode
}

// Modal showing a PSBT as a (possibly animated) RAW, UR or BBQR QR code, with
// density and animation speed controls.
function SSPsbtQRExportModal({
  visible,
  onClose,
  psbtBase64,
  initialDisplayMode
}: SSPsbtQRExportModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const {
    animationSpeed,
    displayMode,
    getDisplayModeDescription,
    getQRValue,
    hasChunks,
    isDataTooLargeForSingleQR,
    isMultiPartQR,
    qrComplexity,
    qrError,
    qrRef,
    setAnimationSpeed,
    setDisplayMode,
    setQrComplexity
  } = usePsbtQrExport(psbtBase64, initialDisplayMode)

  const qrSize = Math.min(
    screenWidth * QR_SIZE_WIDTH_RATIO,
    screenHeight * QR_SIZE_HEIGHT_RATIO,
    QR_SIZE_MAX
  )
  const trackWidth = screenWidth * QR_TRACK_WIDTH_RATIO
  const qrValue = getQRValue()
  const isAtMaxDensity = qrComplexity >= QR_COMPLEXITY_MAX - 1

  function decreaseComplexity() {
    setQrComplexity(Math.max(QR_COMPLEXITY_MIN, qrComplexity - 1))
  }

  function increaseComplexity() {
    const newComplexity = qrComplexity + 1
    if (newComplexity === QR_COMPLEXITY_MAX && isDataTooLargeForSingleQR()) {
      toast.error(t('common.error.dataTooLarge'))
      return
    }
    setQrComplexity(Math.min(QR_COMPLEXITY_MAX, newComplexity))
  }

  function decreaseSpeed() {
    setAnimationSpeed(Math.max(ANIMATION_SPEED_MIN, animationSpeed - 1))
  }

  function increaseSpeed() {
    setAnimationSpeed(Math.min(ANIMATION_SPEED_MAX, animationSpeed + 1))
  }

  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack
        gap="xs"
        style={[
          styles.container,
          { padding: screenWidth * MODAL_PADDING_RATIO }
        ]}
      >
        <SSText color="white" uppercase style={styles.title}>
          {t('transaction.preview.PSBT')}
        </SSText>
        {qrError && (
          <SSText color="white" size="sm" style={styles.statusText}>
            {qrError}
          </SSText>
        )}
        {!qrError && hasChunks && (
          <SSShareableQR
            qrRef={qrRef}
            value={qrValue}
            color={Colors.black}
            backgroundColor={Colors.white}
            size={qrSize}
            hideShareButton={isMultiPartQR}
            containerStyle={[
              styles.qrFrame,
              { width: qrSize + QR_FRAME_PADDING * 2 }
            ]}
          >
            <SSPairedTabs
              activeTab={displayMode}
              onChange={setDisplayMode}
              {...DISPLAY_MODE_TABS}
            />
            <SSText
              center
              color="white"
              size="sm"
              style={{ maxWidth: screenWidth * QR_SIZE_WIDTH_RATIO }}
            >
              {getDisplayModeDescription()}
            </SSText>
            {isDataTooLargeForSingleQR() && isAtMaxDensity && (
              <SSText center color="muted" size="xs">
                {t('transaction.preview.maxDensityLimited')}
              </SSText>
            )}
            <SSText
              center
              color="white"
              size="sm"
              type="mono"
              style={[styles.qrValuePreview, { width: trackWidth }]}
            >
              {qrValue.length > QR_VALUE_PREVIEW_LENGTH
                ? `${qrValue.slice(0, QR_VALUE_PREVIEW_LENGTH)}...`
                : qrValue}
            </SSText>
          </SSShareableQR>
        )}
        {hasChunks ? (
          <SSHStack
            justifyEvenly
            style={{ width: screenWidth * QR_SIZE_WIDTH_RATIO }}
          >
            <SSVStack gap="xs">
              <SSText color="white" size="sm" center>
                {t('transaction.preview.qrDensity', {
                  max: QR_COMPLEXITY_MAX,
                  value: qrComplexity
                })}
              </SSText>
              <SSHStack gap="sm" style={styles.stepButtons}>
                <SSButton
                  variant="outline"
                  label="-"
                  onPress={decreaseComplexity}
                  style={styles.stepButton}
                />
                <SSButton
                  variant={
                    qrComplexity === QR_COMPLEXITY_MAX - 1 &&
                    isDataTooLargeForSingleQR()
                      ? 'ghost'
                      : 'outline'
                  }
                  label="+"
                  onPress={increaseComplexity}
                  style={styles.stepButton}
                />
              </SSHStack>
            </SSVStack>
            <SSVStack gap="xs">
              <SSText color="white" size="sm" center>
                {t('transaction.preview.speedValue', {
                  max: ANIMATION_SPEED_MAX,
                  value: animationSpeed
                })}
              </SSText>
              <SSHStack gap="sm" style={styles.stepButtons}>
                <SSButton
                  variant="outline"
                  label="-"
                  onPress={decreaseSpeed}
                  style={styles.stepButton}
                />
                <SSButton
                  variant="outline"
                  label="+"
                  onPress={increaseSpeed}
                  style={styles.stepButton}
                />
              </SSHStack>
            </SSVStack>
          </SSHStack>
        ) : (
          <SSText color="white" size="sm" style={styles.statusText}>
            {t('common.loading')}
          </SSText>
        )}
      </SSVStack>
    </SSModal>
  )
}

export default SSPsbtQRExportModal
