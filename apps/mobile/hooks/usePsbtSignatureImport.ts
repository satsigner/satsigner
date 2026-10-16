import { hex } from '@scure/base'
import { useState } from 'react'

import { WATCH_ONLY_INDEX } from '@/constants/account'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useNFCReader } from '@/hooks/useNFCReader'
import { type Notice } from '@/types/ui/notice'
import { type DetectedContent } from '@/utils/contentDetector'

type UsePsbtSignatureImportParams = {
  /** Binds data to the PSBT under review and stores it; false if rejected. */
  importSignedData: (cosignerIndex: number, data: string) => boolean
  /** Stores data for a cosigner as is (NFC reads are stored unbound). */
  storeSignedData: (cosignerIndex: number, data: string) => void
  signWithMnemonic: (cosignerIndex: number, mnemonic: string) => void
  onNotice: (notice: Notice) => void
}

/**
 * Imports signed PSBTs or transactions for the PSBT under review from the
 * clipboard, NFC or a scanned QR (a scanned SeedQR signs directly).
 */
export function usePsbtSignatureImport({
  importSignedData,
  storeSignedData,
  signWithMnemonic,
  onNotice
}: UsePsbtSignatureImportParams) {
  const { pasteFromClipboardSilent } = useClipboardPaste()
  const {
    isHardwareSupported: isNfcSupported,
    isReading,
    readNFCTag,
    cancelNFCScan
  } = useNFCReader()
  const [nfcScanModalVisible, setNfcScanModalVisible] = useState(false)

  async function pasteFromClipboard(cosignerIndex: number) {
    const text = await pasteFromClipboardSilent()
    if (!text) {
      onNotice({ key: 'common.error.noClipboardData', type: 'error' })
      return
    }

    if (!importSignedData(cosignerIndex, text)) {
      return
    }

    onNotice({ key: 'common.success.dataPasted', type: 'success' })
  }

  // Routes a scanned QR: a SeedQR signs for the selected cosigner, a PSBT or
  // signed transaction is stored as that cosigner's signature (or the
  // watch-only import when no cosigner is selected).
  function handleScannedContent(
    content: DetectedContent,
    cosignerIndex: number | null
  ) {
    const mnemonic = content.metadata?.mnemonic
    const isSeedQr = content.type === 'seed_qr' && typeof mnemonic === 'string'
    const isSignedData =
      content.type === 'psbt' || content.type === 'bitcoin_transaction'

    if (isSeedQr && cosignerIndex !== null) {
      signWithMnemonic(cosignerIndex, mnemonic)
      return
    }

    if (!isSignedData) {
      onNotice({ key: 'camera.error.invalidContent', type: 'error' })
      return
    }

    if (!importSignedData(cosignerIndex ?? WATCH_ONLY_INDEX, content.cleaned)) {
      return
    }
    onNotice({ key: 'common.success.qrScanned', type: 'success' })
  }

  async function importFromNfc(cosignerIndex: number) {
    if (isReading) {
      await cancelNFCScan()
      setNfcScanModalVisible(false)
      return
    }

    setNfcScanModalVisible(true)
    try {
      const result = await readNFCTag()
      const signedData = result?.txData
        ? hex.encode(result.txData)
        : result?.txId
      if (!signedData) {
        onNotice({ key: 'watchonly.read.nfcErrorNoData', type: 'error' })
        return
      }
      storeSignedData(cosignerIndex, signedData)
      onNotice({ key: 'transaction.preview.nfcImported', type: 'success' })
    } catch {
      onNotice({ key: 'nfc.error.readFailed', type: 'error' })
    } finally {
      setNfcScanModalVisible(false)
    }
  }

  function closeNfcScanModal() {
    setNfcScanModalVisible(false)
    if (isReading) {
      cancelNFCScan()
    }
  }

  return {
    closeNfcScanModal,
    handleScannedContent,
    importFromNfc,
    isNfcSupported,
    isReading,
    nfcScanModalVisible,
    pasteFromClipboard
  }
}
