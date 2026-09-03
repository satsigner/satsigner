import * as Clipboard from 'expo-clipboard'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSModal from '@/components/SSModal'
import SSNFCModal from '@/components/SSNFCModal'
import SSShareableQR from '@/components/SSShareableQR'
import SSText from '@/components/SSText'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { BBQRFileTypes, createBBQRChunks } from '@/utils/bbqr'
import { type DetectedContent } from '@/utils/contentDetector'
import { normalizePsbtToBase64 } from '@/utils/psbtTransport'

const QR_SIZE = Math.min(Dimensions.get('window').width * 0.72, 280)
const BBQR_CHUNK_SIZE = 200
const QR_ANIMATION_MS = 280

type SSPsbtTransportProps = {
  mode: 'export' | 'import'
  psbtBase64?: string
  onImport?: (psbtBase64: string) => void
  disabled?: boolean
  loading?: boolean
  copyLabel?: string
  pasteLabel?: string
  testIDPrefix?: string
}

function SSPsbtTransport({
  mode,
  psbtBase64,
  onImport,
  disabled = false,
  loading = false,
  copyLabel,
  pasteLabel,
  testIDPrefix = 'psbt-transport'
}: SSPsbtTransportProps) {
  const [qrVisible, setQrVisible] = useState(false)
  const [cameraVisible, setCameraVisible] = useState(false)
  const [nfcVisible, setNfcVisible] = useState(false)
  const [chunkIndex, setChunkIndex] = useState(0)
  const qrRef = useRef<View>(null)

  const { isHardwareSupported: nfcWriteSupported } = useNFCEmitter()
  const { isHardwareSupported: nfcReadSupported } = useNFCReader()
  const nfcSupported = mode === 'export' ? nfcWriteSupported : nfcReadSupported

  const qrChunks = useMemo(() => {
    if (!psbtBase64) {
      return [] as string[]
    }
    try {
      const bytes = Buffer.from(psbtBase64, 'base64')
      return createBBQRChunks(
        new Uint8Array(bytes),
        BBQRFileTypes.PSBT,
        BBQR_CHUNK_SIZE
      )
    } catch {
      return [] as string[]
    }
  }, [psbtBase64])

  useEffect(() => {
    if (!qrVisible || qrChunks.length <= 1) {
      return
    }
    const timer = setInterval(() => {
      setChunkIndex((prev) => (prev + 1) % qrChunks.length)
    }, QR_ANIMATION_MS)
    return () => clearInterval(timer)
  }, [qrVisible, qrChunks.length])

  useEffect(() => {
    if (qrVisible) {
      setChunkIndex(0)
    }
  }, [qrVisible, psbtBase64])

  async function handleCopy() {
    if (!psbtBase64) {
      return
    }
    await Clipboard.setStringAsync(psbtBase64)
    toast.success(t('common.copiedToClipboard'))
  }

  async function handlePaste() {
    if (!onImport) {
      return
    }
    const clipboardText = await Clipboard.getStringAsync()
    const normalized = normalizePsbtToBase64(clipboardText.trim())
    if (!normalized) {
      toast.error(t('common.psbtTransport.invalidPsbt'))
      return
    }
    onImport(normalized)
  }

  function handleContentScanned(content: DetectedContent) {
    if (!onImport) {
      return
    }
    const candidate =
      content.type === 'psbt'
        ? content.cleaned
        : content.cleaned || content.raw || ''
    const normalized = normalizePsbtToBase64(candidate)
    if (!normalized) {
      toast.error(t('common.psbtTransport.invalidPsbt'))
      return
    }
    setCameraVisible(false)
    onImport(normalized)
  }

  function handleNfcContent(content: string) {
    if (mode === 'import' && onImport) {
      const normalized = normalizePsbtToBase64(content)
      if (!normalized) {
        toast.error(t('common.psbtTransport.invalidPsbt'))
        return
      }
      onImport(normalized)
    }
  }

  const busy = disabled || loading
  const canExport = !!psbtBase64 && !busy
  const qrValue =
    qrChunks.length > 0 ? qrChunks[chunkIndex % qrChunks.length] : ''

  if (mode === 'export') {
    return (
      <>
        <SSVStack gap="sm" widthFull>
          <SSHStack gap="xxs" justifyBetween>
            <SSButton
              testID={`${testIDPrefix}-copy`}
              variant="secondary"
              label={copyLabel ?? t('common.copy')}
              style={{ width: '48%' }}
              disabled={!canExport}
              onPress={handleCopy}
            />
            <SSButton
              testID={`${testIDPrefix}-show-qr`}
              variant="secondary"
              label={t('common.showQR')}
              style={{ width: '48%' }}
              disabled={!canExport || qrChunks.length === 0}
              onPress={() => setQrVisible(true)}
            />
          </SSHStack>
          {nfcSupported ? (
            <SSButton
              testID={`${testIDPrefix}-export-nfc`}
              variant="outline"
              label={t('common.psbtTransport.exportNfc')}
              disabled={!canExport}
              onPress={() => setNfcVisible(true)}
            />
          ) : null}
        </SSVStack>

        <SSModal
          fullOpacity
          visible={qrVisible}
          onClose={() => setQrVisible(false)}
        >
          <SSVStack gap="md" style={{ alignItems: 'center' }}>
            <SSText uppercase>{t('common.psbtTransport.qrTitle')}</SSText>
            {qrValue ? (
              <SSShareableQR
                qrRef={qrRef}
                value={qrValue}
                size={QR_SIZE}
                color={Colors.black}
                backgroundColor={Colors.white}
                hideShareButton={qrChunks.length > 1}
                containerStyle={{
                  alignItems: 'center',
                  backgroundColor: Colors.white,
                  borderRadius: 2,
                  padding: 8
                }}
              >
                {qrChunks.length > 1 ? (
                  <SSText color="muted" size="sm" center>
                    {t('common.psbtTransport.qrPart', {
                      current: (chunkIndex % qrChunks.length) + 1,
                      total: qrChunks.length
                    })}
                  </SSText>
                ) : null}
                <SSText color="muted" size="sm" center>
                  {t('common.psbtTransport.qrHint')}
                </SSText>
              </SSShareableQR>
            ) : (
              <>
                <SSText color="muted">
                  {t('common.psbtTransport.qrError')}
                </SSText>
                <SSText color="muted" size="sm" center>
                  {t('common.psbtTransport.qrHint')}
                </SSText>
              </>
            )}
            <SSButton
              label={t('common.close')}
              variant="ghost"
              onPress={() => setQrVisible(false)}
            />
          </SSVStack>
        </SSModal>

        <SSNFCModal
          visible={nfcVisible}
          mode="write"
          dataToWrite={psbtBase64}
          onClose={() => setNfcVisible(false)}
          onContentRead={() => undefined}
        />
      </>
    )
  }

  return (
    <>
      <SSVStack gap="sm" widthFull>
        <SSHStack gap="xxs" justifyBetween>
          <SSButton
            testID={`${testIDPrefix}-paste`}
            variant="secondary"
            label={pasteLabel ?? t('common.paste')}
            style={{ width: '48%' }}
            disabled={busy}
            loading={loading}
            onPress={handlePaste}
          />
          <SSButton
            testID={`${testIDPrefix}-scan-qr`}
            variant="secondary"
            label={t('common.scanQR')}
            style={{ width: '48%' }}
            disabled={busy}
            onPress={() => setCameraVisible(true)}
          />
        </SSHStack>
        {nfcSupported ? (
          <SSButton
            testID={`${testIDPrefix}-import-nfc`}
            variant="outline"
            label={t('common.psbtTransport.importNfc')}
            disabled={busy}
            onPress={() => setNfcVisible(true)}
          />
        ) : null}
      </SSVStack>

      <SSCameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onContentScanned={handleContentScanned}
        context="bitcoin"
        title={t('common.psbtTransport.scanTitle')}
      />

      <SSNFCModal
        visible={nfcVisible}
        mode="read"
        onClose={() => setNfcVisible(false)}
        onContentRead={handleNfcContent}
      />
    </>
  )
}

export default SSPsbtTransport
