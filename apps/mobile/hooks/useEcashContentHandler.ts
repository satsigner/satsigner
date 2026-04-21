import { useRouter } from 'expo-router'
import { toast } from 'sonner-native'

import { processContentByContext } from '@/hooks/useContentProcessor'
import { t } from '@/locales'
import { useEcashStore } from '@/store/ecash'
import { type DetectedContent } from '@/utils/contentDetector'

type NavigatePath = Parameters<ReturnType<typeof useRouter>['navigate']>[0]

export function useEcashContentHandler() {
  const router = useRouter()
  const activeAccountId = useEcashStore((state) => state.activeAccountId)

  function getAccountPath(subpath: string): string {
    if (!activeAccountId) {
      return `/signer/ecash`
    }
    return `/signer/ecash/account/${activeAccountId}/${subpath}`
  }

  function handleContentScanned(content: DetectedContent) {
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
  }

  function handleSend() {
    router.push(getAccountPath('send') as NavigatePath)
  }

  function handleReceive() {
    router.push(getAccountPath('receive') as NavigatePath)
  }

  return {
    handleContentScanned,
    handleReceive,
    handleSend
  }
}
