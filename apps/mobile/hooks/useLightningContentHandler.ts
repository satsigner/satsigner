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
        const navigate = (
          path: string | { pathname: string; params?: Record<string, unknown> }
        ) => {
          if (typeof path === 'string') {
            router.push(path as any)
          } else {
            router.push(path as any)
          }
        }
        processContentByContext(content, 'lightning', {
          navigate
        })
      } catch (error) {
        const errorMessage = (error as Error).message
        toast.error(errorMessage || 'Failed to process content')
      }
    },
    [router]
  )

  const handleSend = useCallback(() => {
    router.push('/signer/lightning/pay')
  }, [router])

  const handleReceive = useCallback(() => {
    router.push('/signer/lightning/invoice')
  }, [router])

  return {
    handleContentScanned,
    handleSend,
    handleReceive
  }
}
