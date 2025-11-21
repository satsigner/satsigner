import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { type DetectedContent } from '@/utils/contentDetector'
import { processContentByContext } from '@/utils/contentProcessor'

type NavigatePath =
  | string
  | { pathname: string; params?: Record<string, unknown> }

export function useLightningContentHandler() {
  const router = useRouter()

  const handleContentScanned = useCallback(
    (content: DetectedContent) => {
      if (!content.isValid) {
        toast.error('Invalid Lightning content detected')
        return
      }

      try {
        const navigate = (path: NavigatePath) => {
          router.navigate(path)
        }
        processContentByContext(content, 'lightning', {
          navigate
        })
      } catch {
        toast.error(t('lightning.error.processFailed'))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleSend = useCallback(() => {
    router.push('/signer/lightning/pay')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReceive = useCallback(() => {
    router.push('/signer/lightning/invoice')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    handleContentScanned,
    handleSend,
    handleReceive
  }
}
