import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSNFCModal from '@/components/SSNFCModal'
import SSPsbtQRExportModal from '@/components/SSPsbtQRExportModal'
import { QRDisplayMode } from '@/constants/qr'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type DetectedContent } from '@/utils/contentDetector'
import { normalizePsbtToBase64 } from '@/utils/psbtTransport'

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

  const { isHardwareSupported: nfcWriteSupported } = useNFCEmitter()
  const { isHardwareSupported: nfcReadSupported } = useNFCReader()
  const nfcSupported = mode === 'export' ? nfcWriteSupported : nfcReadSupported

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
              disabled={!canExport}
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

        <SSPsbtQRExportModal
          visible={qrVisible}
          onClose={() => setQrVisible(false)}
          psbtBase64={psbtBase64}
          initialDisplayMode={QRDisplayMode.BBQR}
        />

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
