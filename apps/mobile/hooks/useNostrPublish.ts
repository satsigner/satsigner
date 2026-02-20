import { NostrAPI } from '@/api/nostr'
import { type Account } from '@/types/models/Account'
import { compressMessage } from '@/utils/nostr'

export function useNostrPublish() {
  function getTrustedDevices(account: Account): string[] {
    return account.nostr?.trustedMemberDevices || []
  }

  async function sendDM(account: Account, message: string) {
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

    try {
      let nostrApi: NostrAPI | null = null
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

      const trustedDevices = getTrustedDevices(account)
      for (const trustedDeviceNpub of trustedDevices) {
        if (!deviceNsec) continue
        eventKind1059 = await nostrApi.createKind1059(
          deviceNsec,
          trustedDeviceNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)
      }
    } catch (err) {
      // Toast already shown in NostrAPI.publishEvent; rethrow so caller
      // knows publish failed and does not clear input / only adds to chat on success
      throw err
    }
  }

  async function sendPSBT(account: Account, psbt: string) {
    if (!account?.nostr?.autoSync) return
    if (!account || !account.nostr) return
    const { deviceNsec, deviceNpub, relays } = account.nostr

    if (!deviceNsec || !deviceNpub || relays.length === 0) {
      return
    }

    try {
      let nostrApi: NostrAPI | null = null
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

      const trustedDevices = getTrustedDevices(account)
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
    } catch (err) {
      // Toast already shown in NostrAPI.publishEvent; rethrow so caller knows publish failed
      throw err
    }
  }

  return {
    sendDM,
    sendPSBT
  }
}
