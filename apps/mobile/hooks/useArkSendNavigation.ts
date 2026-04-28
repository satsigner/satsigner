import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import {
  type ArkDestinationDraft,
  parseArkDestination
} from '@/utils/arkDestination'
import { type DetectedContent } from '@/utils/contentDetector'
import { getLNURLType } from '@/utils/lnurl'

function detectLNURLWithdraw(raw: string): boolean {
  try {
    const info = getLNURLType(raw)
    return info.isLNURL === true && info.type === 'withdraw'
  } catch {
    return false
  }
}

export function useArkSendNavigation(accountId: string | undefined) {
  const router = useRouter()
  const queryClient = useQueryClient()

  function goToConfirm(cleanedDestination: string, draft: ArkDestinationDraft) {
    if (!accountId) {
      return
    }
    queryClient.setQueryData<ArkDestinationDraft>(
      ['ark', 'send', 'parse', cleanedDestination],
      draft
    )
    router.navigate({
      params: { destination: cleanedDestination, id: accountId },
      pathname: '/signer/ark/account/[id]/send/confirm'
    })
  }

  function goToLnurlWithdraw(lnurl: string) {
    if (!accountId) {
      return
    }
    router.navigate({
      params: { id: accountId, lnurl },
      pathname: '/signer/ark/account/[id]/receive-lnurl-withdraw'
    })
  }

  async function processDestination(raw: string): Promise<boolean> {
    const trimmed = raw.trim()
    if (!trimmed) {
      return false
    }
    if (detectLNURLWithdraw(trimmed)) {
      toast.success(t('ark.receive.lnurlWithdraw.detected'))
      goToLnurlWithdraw(trimmed)
      return true
    }
    const parsed = await parseArkDestination(trimmed)
    if (!parsed.ok) {
      toast.error(t('ark.send.error.invalidDestination'))
      return false
    }
    goToConfirm(trimmed, parsed.draft)
    return true
  }

  function handleContentReady(content: DetectedContent): Promise<boolean> {
    const raw = content.raw ?? content.cleaned
    return processDestination(raw)
  }

  return {
    goToConfirm,
    goToLnurlWithdraw,
    handleContentReady,
    processDestination
  }
}
