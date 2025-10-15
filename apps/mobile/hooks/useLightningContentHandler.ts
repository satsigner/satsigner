import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { type DetectedContent } from '@/utils/contentDetector'
import { processContentByContext } from '@/utils/contentProcessor'

export function useLightningContentHandler() {
  const router = useRouter()

  const handleContentScanned = useCallback(
    (content: DetectedContent) => {
      if (!content.isValid) {
        toast.error('Invalid Lightning content detected')
        return
      }

      try {
        processContentByContext(content, 'lightning', {
          navigate: router.navigate
        })
      } catch (error) {
        const errorMessage = (error as Error).message
        toast.error(errorMessage || 'Failed to process content')
      }
    },
    [router.navigate]
  )

  const handleSend = useCallback(() => {
    router.navigate('/signer/lightning/pay')
  }, [router])

  const handleReceive = useCallback(() => {
    router.navigate('/signer/lightning/invoice')
  }, [router])

  return {
    handleContentScanned,
    handleSend,
    handleReceive
  }
}
