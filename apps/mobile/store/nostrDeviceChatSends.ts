import { create } from 'zustand'

import { omitKey } from '@/utils/object'

type NostrDeviceChatSendsState = {
  /** Account id → message id → device npubs that did not get the message. */
  failedDevicesByAccount: Record<string, Record<string, string[]>>
}

type NostrDeviceChatSendsAction = {
  setFailedDevices: (
    accountId: string,
    messageId: string,
    failedDevices: string[]
  ) => void
}

const useNostrDeviceChatSendsStore = create<
  NostrDeviceChatSendsState & NostrDeviceChatSendsAction
>()((set) => ({
  failedDevicesByAccount: {},
  setFailedDevices: (accountId, messageId, failedDevices) => {
    set((state) => {
      const failedByMessage = state.failedDevicesByAccount[accountId] ?? {}
      return {
        failedDevicesByAccount: {
          ...state.failedDevicesByAccount,
          [accountId]:
            failedDevices.length > 0
              ? { ...failedByMessage, [messageId]: failedDevices }
              : omitKey(failedByMessage, messageId)
        }
      }
    })
  }
}))

export { useNostrDeviceChatSendsStore }
