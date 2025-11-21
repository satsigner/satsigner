import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { type DetectedContent } from '@/utils/contentDetector'
import { processContentByContext } from '@/utils/contentProcessor'

type NavigatePath =
  | string
  | { pathname: string; params?: Record<string, unknown> }

export function useEcashContentHandler() {
  const router = useRouter()

  const handleContentScanned = useCallback(
    (content: DetectedContent) => {
      if (!content.isValid) {
        toast.error('Invalid Ecash content detected')
        return
      }

      try {
        const navigate = (path: NavigatePath) => {
          router.navigate(path)
        }
        processContentByContext(content, 'ecash', {
          navigate
        })
      } catch {
        toast.error(t('ecash.error.processFailed'))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleSend = useCallback(() => {
    router.push('/signer/ecash/send')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReceive = useCallback(() => {
    router.push('/signer/ecash/receive')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    handleContentScanned,
    handleSend,
    handleReceive
  }
}
