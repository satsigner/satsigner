import { type Href, useRouter } from 'expo-router'
import { useState } from 'react'

import { useNFCReader } from '@/hooks/useNFCReader'
import { t } from '@/locales'
import {
  type ContentContext,
  detectContentByContext,
  type DetectedContent,
  prepareEcashTokenInput
} from '@/utils/contentDetector'
import { getContentHref } from '@/utils/contentProcessor'

type UseContentHandlerProps = {
  context: ContentContext
  sendHref: Href
  receiveHref: Href
  onContentScanned?: (content: DetectedContent) => void | Promise<void>
  onError?: (message: string) => void
}

export function useContentHandler({
  context,
  sendHref,
  receiveHref,
  onContentScanned,
  onError
}: UseContentHandlerProps) {
  const router = useRouter()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [nfcModalVisible, setNfcModalVisible] = useState(false)
  const [pasteModalVisible, setPasteModalVisible] = useState(false)

  const { isHardwareSupported: nfcAvailable } = useNFCReader()

  function navigateToContent(content: DetectedContent) {
    if (!content.isValid) {
      onError?.(t('camera.invalidContent', { context }))
      return
    }
    const href = getContentHref(content, context)
    if (!href) {
      onError?.(t('paste.error.incompatibleContent'))
      return
    }
    router.navigate(href)
  }

  const handleContentScanned = onContentScanned ?? navigateToContent

  function handleNFCContentRead(content: string) {
    const normalized =
      context === 'ecash' ? prepareEcashTokenInput(content) : content
    handleContentScanned(detectContentByContext(normalized, context))
  }

  return {
    cameraModalVisible,
    closeCameraModal: () => setCameraModalVisible(false),
    closeNFCModal: () => setNfcModalVisible(false),
    closePasteModal: () => setPasteModalVisible(false),
    handleCamera: () => setCameraModalVisible(true),
    handleContentPasted: handleContentScanned,
    handleContentScanned,
    handleNFC: () => setNfcModalVisible(true),
    handleNFCContentRead,
    handlePaste: () => setPasteModalVisible(true),
    handleReceive: () => router.push(receiveHref),
    handleSend: () => router.push(sendHref),
    nfcAvailable,
    nfcModalVisible,
    pasteModalVisible
  }
}
