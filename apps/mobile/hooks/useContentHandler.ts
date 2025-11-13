import { useCallback, useState } from 'react'

import { useNFCReader } from '@/hooks/useNFCReader'
import { type DetectedContent } from '@/utils/contentDetector'

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
  // Modal state management
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [nfcModalVisible, setNfcModalVisible] = useState(false)
  const [pasteModalVisible, setPasteModalVisible] = useState(false)

  // NFC reader hook
  const { isAvailable: nfcAvailable } = useNFCReader()

  // Content processing callbacks
  const handleContentPasted = useCallback(
    (content: DetectedContent) => {
      onContentScanned(content)
    },
    [onContentScanned]
  )

  const handleNFCContentRead = useCallback(
    (content: string) => {
      // Process NFC content through the content detector
      import('@/utils/contentDetector').then(({ detectContentByContext }) => {
        const detectedContent = detectContentByContext(content, context)
        onContentScanned(detectedContent)
      })
    },
    [context, onContentScanned]
  )

  // Action handlers
  const handlePaste = useCallback(() => {
    setPasteModalVisible(true)
  }, [])

  const handleCamera = useCallback(() => {
    setCameraModalVisible(true)
  }, [])

  const handleNFC = useCallback(() => {
    setNfcModalVisible(true)
  }, [])

  // Modal close handlers
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
    // Modal state
    cameraModalVisible,
    nfcModalVisible,
    pasteModalVisible,

    // Modal close handlers
    closeCameraModal,
    closeNFCModal,
    closePasteModal,

    // Action handlers
    handleSend: onSend,
    handlePaste,
    handleCamera,
    handleNFC,
    handleReceive: onReceive,

    // Content handlers
    handleContentScanned: onContentScanned,
    handleContentPasted,
    handleNFCContentRead,

    // NFC availability
    nfcAvailable
  }
}
