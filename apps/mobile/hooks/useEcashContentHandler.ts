import { type Href, useRouter } from 'expo-router'
import { toast } from 'sonner-native'

import { processContentByContext } from '@/hooks/useContentProcessor'
import { t } from '@/locales'
import { useEcashStore } from '@/store/ecash'
import { type DetectedContent } from '@/utils/contentDetector'

type NavigatePath = Parameters<ReturnType<typeof useRouter>['navigate']>[0]

type EcashAccountPathname =
  | '/signer/ecash/account/[id]/send'
  | '/signer/ecash/account/[id]/receive'

export function useEcashContentHandler() {
  const router = useRouter()
  const activeAccountId = useEcashStore((state) => state.activeAccountId)

  function getAccountHref(pathname: EcashAccountPathname): Href {
    if (!activeAccountId) {
      return '/signer/ecash'
    }
    return { params: { id: activeAccountId }, pathname }
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
    router.push(getAccountHref('/signer/ecash/account/[id]/send'))
  }

  function handleReceive() {
    router.push(getAccountHref('/signer/ecash/account/[id]/receive'))
  }

  return {
    handleContentScanned,
    handleReceive,
    handleSend
  }
}
