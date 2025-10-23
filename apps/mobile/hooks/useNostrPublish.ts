import { toast } from 'sonner-native'

import { compressMessage, NostrAPI } from '@/api/nostr'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

function getTrustedDevices(accountId: string): string[] {
  const account = useAccountsStore
    .getState()
    .accounts.find((account) => account.id === accountId)
  return account?.nostr?.trustedMemberDevices || []
}

export function useNostrPublish() {
  const sendDM = async (account: Account, message: string) => {
    if (!account?.nostr?.autoSync) return
    if (!account || !account.nostr) return
    const { commonNsec, commonNpub, deviceNsec, deviceNpub, relays } =
      account.nostr

    if (
      !commonNsec ||
      !commonNpub ||
      relays.length === 0 ||
      !deviceNsec ||
      !deviceNpub
    ) {
      return
    }

    let nostrApi: NostrAPI | null = null
    try {
      const messageContent = {
        created_at: Math.floor(Date.now() / 1000),
        description: message
      }

      const compressedMessage = compressMessage(messageContent)
      nostrApi = new NostrAPI(relays)
      await nostrApi.connect()

      let eventKind1059 = await nostrApi.createKind1059(
        deviceNsec,
        deviceNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(eventKind1059)

      const trustedDevices = getTrustedDevices(account.id)
      for (const trustedDeviceNpub of trustedDevices) {
        if (!deviceNsec) continue
        eventKind1059 = await nostrApi.createKind1059(
          deviceNsec,
          trustedDeviceNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)
      }
    } catch (_error) {
      toast.error('Failed to send message')
    }
  }

  const sendPSBT = async (account: Account, psbt: string) => {
    if (!account?.nostr?.autoSync) return
    if (!account || !account.nostr) return
    const { deviceNsec, deviceNpub, relays } = account.nostr

    if (!deviceNsec || !deviceNpub || relays.length === 0) {
      return
    }

    let nostrApi: NostrAPI | null = null
    try {
      const messageContent = {
        created_at: Math.floor(Date.now() / 1000),
        description: 'PSBT for signing',
        data: { data: psbt, data_type: 'PSBT' }
      }

      const compressedMessage = compressMessage(messageContent)
      nostrApi = new NostrAPI(relays)
      await nostrApi.connect()

      const selfEvent = await nostrApi.createKind1059(
        deviceNsec,
        deviceNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(selfEvent)

      const trustedDevices = getTrustedDevices(account.id)
      for (const trustedDeviceNpub of trustedDevices) {
        if (!deviceNsec) continue
        if (trustedDeviceNpub === deviceNpub) continue
        const eventKind1059 = await nostrApi.createKind1059(
          deviceNsec,
          trustedDeviceNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)
      }
    } catch {
      toast.error('Failed to send PSBT')
    }
  }

  return {
    sendDM,
    sendPSBT
  }
}
