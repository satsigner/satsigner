import { useState } from 'react'

import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { type Notice } from '@/types/ui/notice'
import { getNfcErrorKey } from '@/utils/nfcError'

type UsePsbtNfcExportParams = {
  psbtHex: string
  onNotice: (notice: Notice) => void
}

export function usePsbtNfcExport({
  psbtHex,
  onNotice
}: UsePsbtNfcExportParams) {
  const { isEmitting, emitNFCTag, cancelNFCScan } = useNFCEmitter()
  const [nfcExportModalVisible, setNfcExportModalVisible] = useState(false)
  const [nfcErrorKey, setNfcErrorKey] = useState<string | null>(null)

  async function startOrCancelNfcExport() {
    if (isEmitting) {
      await cancelNFCScan()
      setNfcExportModalVisible(false)
      setNfcErrorKey(null)
      return
    }

    if (!psbtHex) {
      onNotice({ key: 'error.psbt.notAvailable', type: 'error' })
      return
    }

    setNfcExportModalVisible(true)
    setNfcErrorKey(null)
    try {
      await emitNFCTag(psbtHex)
      onNotice({ key: 'transaction.preview.nfcExported', type: 'success' })
      setNfcExportModalVisible(false)
    } catch (error) {
      const errorKey = getNfcErrorKey(error, 'nfc.error.writeFailed')
      const wasCancelled = errorKey === null
      if (wasCancelled) {
        setNfcExportModalVisible(false)
        return
      }
      setNfcErrorKey(errorKey)
      onNotice({ key: errorKey, type: 'error' })
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
    isEmitting,
    nfcErrorKey,
    nfcExportModalVisible,
    startOrCancelNfcExport
  }
}
