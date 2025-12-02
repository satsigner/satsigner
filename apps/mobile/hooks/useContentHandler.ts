import { useCallback, useState } from 'react'

import { useNFCReader } from '@/hooks/useNFCReader'
import {
  detectContentByContext,
  type DetectedContent
} from '@/utils/contentDetector'

type UseContentHandlerProps = {
  context: 'bitcoin' | 'lightning' | 'ecash'
  onContentScanned: (content: DetectedContent) => void
  onSend: () => void
  onReceive: () => void
}

export function useContentHandler({
  context,
  onContentScanned,
  onSend,
  onReceive
}: UseContentHandlerProps) {
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [nfcModalVisible, setNfcModalVisible] = useState(false)
  const [pasteModalVisible, setPasteModalVisible] = useState(false)

  const { isAvailable: nfcAvailable } = useNFCReader()

  const handleContentPasted = useCallback(
    (content: DetectedContent) => {
      onContentScanned(content)
    },
    [onContentScanned]
  )

  const handleNFCContentRead = useCallback(
    async (content: string) => {
      const detectedContent = await detectContentByContext(content, context)
      onContentScanned(detectedContent)
    },
    [context, onContentScanned]
  )

  const handlePaste = useCallback(() => {
    setPasteModalVisible(true)
  }, [])

  const handleCamera = useCallback(() => {
    setCameraModalVisible(true)
  }, [])

  const handleNFC = useCallback(() => {
    setNfcModalVisible(true)
  }, [])

  const closeCameraModal = useCallback(() => {
    setCameraModalVisible(false)
  }, [])

  const closeNFCModal = useCallback(() => {
    setNfcModalVisible(false)
  }, [])

  const closePasteModal = useCallback(() => {
    setPasteModalVisible(false)
  }, [])

  return {
    cameraModalVisible,
    nfcModalVisible,
    pasteModalVisible,
    closeCameraModal,
    closeNFCModal,
    closePasteModal,
    handleSend: onSend,
    handlePaste,
    handleCamera,
    handleNFC,
    handleReceive: onReceive,
    handleContentScanned: onContentScanned,
    handleContentPasted,
    handleNFCContentRead,
    nfcAvailable
  }
}
