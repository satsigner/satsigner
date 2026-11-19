import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { useRef, useState } from 'react'

import {
  getChatBitcoinPayAccounts,
  startChatBitcoinRequestPay
} from '@/services/chatBitcoinRequestPay'
import { useAccountsStore } from '@/store/accounts'
import type { Account } from '@/types/models/Account'
import type { ChatBitcoinRequest } from '@/utils/chatPaymentRequests'

/**
 * Paying a bitcoin: URI found in a chat message: picks the account (the only
 * one on the request's network, or the picker sheet) and opens its
 * transaction preview. Nothing is signed or sent here.
 */
function useChatBitcoinRequestPay() {
  const router = useRouter()
  const accounts = useAccountsStore((state) => state.accounts)
  const accountSheetRef = useRef<BottomSheetMethods>(null)
  const [pending, setPending] = useState<ChatBitcoinRequest | null>(null)

  function navigate(href: Href) {
    router.navigate(href)
  }

  function canPay(request: ChatBitcoinRequest) {
    return getChatBitcoinPayAccounts(accounts, request).length > 0
  }

  function pay(request: ChatBitcoinRequest) {
    const payAccounts = getChatBitcoinPayAccounts(accounts, request)
    const [onlyAccount] = payAccounts
    if (payAccounts.length === 1 && onlyAccount) {
      startChatBitcoinRequestPay(onlyAccount, request, navigate)
      return
    }
    setPending(request)
    accountSheetRef.current?.expand()
  }

  function selectAccount(account: Account) {
    accountSheetRef.current?.close()
    if (pending) {
      startChatBitcoinRequestPay(account, pending, navigate)
    }
    setPending(null)
  }

  return {
    accountSheetRef,
    canPay,
    pay,
    pendingAccounts: pending
      ? getChatBitcoinPayAccounts(accounts, pending)
      : [],
    pendingAmountSats: pending?.amountSats ?? 0,
    selectAccount
  }
}

export { useChatBitcoinRequestPay }
