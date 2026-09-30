import { type Href, useRouter } from 'expo-router'
import { useState } from 'react'
import { toast } from 'sonner-native'

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
  /** Defaults to navigating to the screen `getContentHref` picks. */
  onContentScanned?: (content: DetectedContent) => void | Promise<void>
}

/**
 * Drives the paste/camera/NFC modals and send/receive buttons of an account
 * screen. Scanned content goes to `onContentScanned`, or is routed by type.
 */
export function useContentHandler({
  context,
  sendHref,
  receiveHref,
  onContentScanned
}: UseContentHandlerProps) {
  const router = useRouter()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [nfcModalVisible, setNfcModalVisible] = useState(false)
  const [pasteModalVisible, setPasteModalVisible] = useState(false)

  const { isHardwareSupported: nfcAvailable } = useNFCReader()

  function navigateToContent(content: DetectedContent) {
    if (!content.isValid) {
      toast.error(t('camera.invalidContent', { context }))
      return
    }
    const href = getContentHref(content, context)
    if (!href) {
      toast.error(t('paste.error.incompatibleContent'))
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
