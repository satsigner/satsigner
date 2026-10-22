import { hex } from '@scure/base'
import { useState } from 'react'

import { WATCH_ONLY_COSIGNER_INDEX } from '@/constants/account'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useNFCReader } from '@/hooks/useNFCReader'
import { type NFCReadResult } from '@/types/models/Nfc'
import { type Notice } from '@/types/ui/notice'
import { type DetectedContent } from '@/utils/contentDetector'
import { getNfcErrorKey } from '@/utils/nfcError'

type UsePsbtSignatureImportParams = {
  importSignedDataMatchingPsbt: (cosignerIndex: number, data: string) => boolean
  signWithMnemonic: (cosignerIndex: number, mnemonic: string) => void
  onNotice: (notice: Notice) => void
}

function getSignedDataFromNfcRecords(result: NFCReadResult | null) {
  if (result?.txnRecordPayload) {
    return hex.encode(result.txnRecordPayload)
  }
  return result?.textRecordSignedTxHex
}

export function usePsbtSignatureImport({
  importSignedDataMatchingPsbt,
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

    if (!importSignedDataMatchingPsbt(cosignerIndex, text)) {
      return
    }

    onNotice({ key: 'common.success.dataPasted', type: 'success' })
  }

  function signOrImportScannedContent(
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

    if (
      !importSignedDataMatchingPsbt(
        cosignerIndex ?? WATCH_ONLY_COSIGNER_INDEX,
        content.cleaned
      )
    ) {
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
    const [read] = await Promise.allSettled([readNFCTag()])
    setNfcScanModalVisible(false)

    if (read.status === 'rejected') {
      const errorKey = getNfcErrorKey(read.reason, 'nfc.error.readFailed')
      if (errorKey) {
        onNotice({ key: errorKey, type: 'error' })
      }
      return
    }

    const signedData = getSignedDataFromNfcRecords(read.value)
    if (!signedData) {
      onNotice({ key: 'watchonly.read.nfcErrorNoData', type: 'error' })
      return
    }
    if (!importSignedDataMatchingPsbt(cosignerIndex, signedData)) {
      return
    }
    onNotice({ key: 'transaction.preview.nfcImported', type: 'success' })
  }

  function closeNfcScanModal() {
    setNfcScanModalVisible(false)
    if (isReading) {
      cancelNFCScan()
    }
  }

  return {
    closeNfcScanModal,
    importFromNfc,
    isNfcSupported,
    isReading,
    nfcScanModalVisible,
    pasteFromClipboard,
    signOrImportScannedContent
  }
}
