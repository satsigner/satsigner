import { clearNdkRegistry } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import { listChatThread } from '@/db/queries/nostrChat'
import nostrPublish from '@/hooks/useNostrPublish'
import { useAccountsStore } from '@/store/accounts'
import {
  acquireChatPipeline,
  clearRecipientRelaysCache,
  closeActiveChatPipeline,
  getChatPipelineStatus,
  sendNip17Chat
} from '@/utils/nostrChat'
import { nostrSyncService } from '@/utils/nostrSyncService'

import { createTestIdentity } from '../support/identities'
import { resetNodeNitroSqlite } from '../support/nodeNitroSqlite'
import {
  configuredLiveRelays,
  probeReachableRelaysSync
} from '../support/reachableRelays'
import {
  createSyncAccountKeys,
  installSyncAccount,
  storedDmIds
} from '../support/syncAccount'
import { waitFor } from '../support/waitFor'

const LIVE_WAIT_MS = 45_000
const LIVE_TEST_TIMEOUT_MS = 90_000
const THREAD_LIMIT = 10

const reachableRelays = probeReachableRelaysSync(configuredLiveRelays())
const describeWhenReachable =
  reachableRelays.length > 0 ? describe : describe.skip

describeWhenReachable(
  `live public relays (${reachableRelays.join(', ') || 'none reachable'})`,
  () => {
    afterEach(async () => {
      closeActiveChatPipeline()
      await nostrSyncService.stopAll()
      nostrSyncService.resetInstance()
      clearNdkRegistry()
    })

    afterAll(() => {
      clearRecipientRelaysCache()
      resetNodeNitroSqlite()
    })

    test(
      'roundtrips a NIP-17 message from sendNip17Chat to the receiving pipeline',
      async () => {
        const sender = createTestIdentity()
        const receiver = createTestIdentity()
        const text = `satsigner live nip17 ${Date.now()}`
        const lease = acquireChatPipeline({
          npub: receiver.npub,
          nsec: receiver.nsec,
          relays: reachableRelays
        })
        await lease.ready

        expect(getChatPipelineStatus(receiver.npub).state).toBe('live')

        await sendNip17Chat(
          new NostrAPI(reachableRelays),
          { npub: sender.npub, nsec: sender.nsec, relays: reachableRelays },
          receiver.npub,
          text
        )
        await waitFor(
          () =>
            listChatThread(receiver.npub, 'nip17', sender.pubkey, THREAD_LIMIT)
              .length > 0,
          { label: 'live NIP-17 delivery', timeoutMs: LIVE_WAIT_MS }
        )
        lease.release()

        expect(
          listChatThread(receiver.npub, 'nip17', sender.pubkey, THREAD_LIMIT)
        ).toMatchObject([{ content: text, direction: 'in', status: 'sent' }])
        expect(
          listChatThread(sender.npub, 'nip17', receiver.pubkey, THREAD_LIMIT)
        ).toMatchObject([{ content: text, direction: 'out', status: 'sent' }])
      },
      LIVE_TEST_TIMEOUT_MS
    )

    test(
      'roundtrips a gift-wrapped device-sync DM between two throwaway devices',
      async () => {
        const receiverKeys = createSyncAccountKeys()
        const senderKeys = {
          common: receiverKeys.common,
          device: receiverKeys.peerDevice,
          peerDevice: receiverKeys.device
        }
        const receiver = installSyncAccount(
          'live-receiver',
          receiverKeys,
          reachableRelays
        )
        const sender = installSyncAccount(
          'live-sender',
          senderKeys,
          reachableRelays
        )
        const message = `satsigner live device sync ${Date.now()}`

        const sent = await nostrPublish().sendDM(sender, message)
        await nostrSyncService.startSync(receiver.id)
        await waitFor(() => storedDmIds(receiver.id).length > 0, {
          label: 'live device-sync delivery',
          timeoutMs: LIVE_WAIT_MS
        })

        expect(sent.delivered).toContain(receiverKeys.device.npub)
        const stored = useAccountsStore
          .getState()
          .accounts.find((account) => account.id === receiver.id)?.nostr.dms
        expect(stored).toMatchObject([
          { author: receiverKeys.peerDevice.pubkey, description: message }
        ])
      },
      LIVE_TEST_TIMEOUT_MS
    )
  }
)
