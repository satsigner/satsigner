import { useState } from 'react'

import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { type Notice } from '@/types/ui/notice'

type UsePsbtNfcExportParams = {
  /** The PSBT under review, hex encoded. */
  serializedPsbt: string
  onNotice: (notice: Notice) => void
}

/**
 * Emits the PSBT under review over NFC. Pressing export again while emitting
 * cancels it. A failed write keeps the modal open with the error until it is
 * dismissed.
 */
export function usePsbtNfcExport({
  serializedPsbt,
  onNotice
}: UsePsbtNfcExportParams) {
  const { isEmitting, emitNFCTag, cancelNFCScan } = useNFCEmitter()
  const [nfcExportModalVisible, setNfcExportModalVisible] = useState(false)
  const [nfcErrorKey, setNfcErrorKey] = useState<string | null>(null)

  async function exportToNfc() {
    if (isEmitting) {
      await cancelNFCScan()
      setNfcExportModalVisible(false)
      setNfcErrorKey(null)
      return
    }

    if (!serializedPsbt) {
      onNotice({ key: 'error.psbt.notAvailable', type: 'error' })
      return
    }

    setNfcExportModalVisible(true)
    setNfcErrorKey(null)
    try {
      await emitNFCTag(serializedPsbt)
      onNotice({ key: 'transaction.preview.nfcExported', type: 'success' })
      setNfcExportModalVisible(false)
    } catch {
      setNfcErrorKey('nfc.error.writeFailed')
      onNotice({ key: 'nfc.error.writeFailed', type: 'error' })
    }
  }

  function closeNfcExportModal() {
    setNfcExportModalVisible(false)
    setNfcErrorKey(null)
    if (isEmitting) {
      cancelNFCScan()
    }
  }

  return {
    closeNfcExportModal,
    exportToNfc,
    isEmitting,
    nfcErrorKey,
    nfcExportModalVisible
  }
}
