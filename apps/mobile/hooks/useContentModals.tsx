import { type ReactElement } from 'react'

import SSCameraModal from '@/components/SSCameraModal'
import SSNFCModal from '@/components/SSNFCModal'
import SSPaste from '@/components/SSPaste'
import { type DetectedContent } from '@/utils/contentDetector'

type UseContentModalsProps = {
  visible: {
    camera: boolean
    nfc: boolean
    paste: boolean
  }
  onClose: {
    camera: () => void
    nfc: () => void
    paste: () => void
  }
  onContentScanned: (content: DetectedContent) => void
  onContentPasted: (content: DetectedContent) => void
  onNFCContentRead: (content: string) => void
  context: 'bitcoin' | 'lightning' | 'ecash'
}

export function useContentModals({
  visible,
  onClose,
  onContentScanned,
  onContentPasted,
  onNFCContentRead,
  context
}: UseContentModalsProps) {
  const getContextTitle = (context: string) => {
    switch (context) {
      case 'bitcoin':
        return 'Scan Bitcoin Content'
      case 'lightning':
        return 'Scan Lightning Content'
      case 'ecash':
        return 'Scan Ecash Content'
      default:
        return 'Scan Content'
    }
  }

  const cameraModal: ReactElement = (
    <SSCameraModal
      visible={visible.camera}
      onClose={onClose.camera}
      onContentScanned={onContentScanned}
      context={context}
      title={getContextTitle(context)}
    />
  )

  const nfcModal: ReactElement = (
    <SSNFCModal
      visible={visible.nfc}
      onClose={onClose.nfc}
      onContentRead={onNFCContentRead}
      context={context}
      mode="read"
    />
  )

  const pasteModal: ReactElement = (
    <SSPaste
      visible={visible.paste}
      onClose={onClose.paste}
      onContentPasted={onContentPasted}
      context={context}
    />
  )

  return {
    cameraModal,
    nfcModal,
    pasteModal
  }
}
