import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

import { useEcashStore } from '@/store/ecash'

/**
 * Makes the account a screen shows the active one when that screen gains
 * focus, so the send, receive and settings screens it opens act on it.
 * Screens left mounted lower in the stack never take it back, and a deleted
 * account is never made active again.
 */
export function useEcashActiveAccountSync(accountId: string) {
  const accountExists = useEcashStore((state) =>
    state.accounts.some((account) => account.id === accountId)
  )

  // useCallback required: useFocusEffect re-runs whenever the callback
  // identity changes.
  useFocusEffect(
    useCallback(() => {
      const { activeAccountId, setActiveAccountId } = useEcashStore.getState()
      if (!accountExists || activeAccountId === accountId) {
        return
      }
      setActiveAccountId(accountId)
    }, [accountExists, accountId])
  )
}
