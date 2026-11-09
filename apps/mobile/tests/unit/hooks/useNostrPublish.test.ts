import { sendDeviceDM, sendDevicePSBT } from '@/hooks/useNostrPublish'
import { type Account } from '@/types/models/Account'
import { NostrNoRelaysError, NostrPartialSendError } from '@/utils/errors'

const mockPublishFailures = new Set<string>()
const mockConnect = jest.fn()
const mockClose = jest.fn()
const mockPublished: string[] = []
const mockWrappedRumorIds: string[] = []
const mockRecordMessageWraps = jest.fn()

jest.mock<typeof import('@/api/nostr')>('@/api/nostr', () => ({
  NostrAPI: jest.fn(() => ({
    closeAllSubscriptions: mockClose,
    connect: mockConnect,
    publishEvent: ({ recipient }: { recipient: string }) => {
      if (mockPublishFailures.has(recipient)) {
        return Promise.reject(new Error(`relay rejected ${recipient}`))
      }
      mockPublished.push(recipient)
      return Promise.resolve()
    }
  }))
}))

jest.mock<typeof import('@/api/nostrGiftWrap')>('@/api/nostrGiftWrap', () => ({
  createChatRumor: ({ content, kind, tags }) => ({
    content,
    created_at: 1,
    id: `rumor-${content}`,
    kind,
    pubkey: 'self',
    tags
  }),
  createDerivedGiftWrap: (rumor, _secretKey, recipient: string) => {
    mockWrappedRumorIds.push(rumor.id)
    return Promise.resolve({ id: `wrap-${recipient}`, recipient })
  },
  toNdkEvent: (event: unknown) => event
}))

jest.mock<typeof import('@/db/nostrMessageState')>(
  '@/db/nostrMessageState',
  () => ({
    recordMessageWraps: (...args: unknown[]) => mockRecordMessageWraps(...args)
  })
)

jest.mock<typeof import('@/utils/nostr')>('@/utils/nostr', () => ({
  compressMessage: (payload: unknown) => JSON.stringify(payload),
  getPubKeyHexFromNpub: (npub: string) => npub,
  getSecretFromNsec: () => new Uint8Array(32)
}))

const SELF = 'npub1self'
const PEER_A = 'npub1peera'
const PEER_B = 'npub1peerb'

const account = {
  id: 'account-1',
  nostr: {
    autoSync: true,
    deviceNpub: SELF,
    deviceNsec: 'nsec1self',
    relays: ['wss://relay.test'],
    trustedMemberDevices: [PEER_A, PEER_B, SELF]
  }
} as unknown as Account

describe('device sends', () => {
  beforeEach(() => {
    mockPublishFailures.clear()
    mockPublished.length = 0
    mockWrappedRumorIds.length = 0
    mockRecordMessageWraps.mockReset()
    mockConnect.mockReset().mockResolvedValue(true)
  })

  it('sends to this device and every trusted device once', async () => {
    const result = await sendDeviceDM(account, 'hello')

    expect(result).toStrictEqual({
      delivered: [SELF, PEER_A, PEER_B],
      failed: []
    })
    expect(mockPublished).toStrictEqual([SELF, PEER_A, PEER_B])
    expect(mockClose).toHaveBeenCalledWith()
  })

  it('wraps one shared rumor for every device and records the wraps', async () => {
    await sendDeviceDM(account, 'hello')

    expect(new Set(mockWrappedRumorIds).size).toBe(1)
    expect(mockRecordMessageWraps).toHaveBeenCalledWith(
      'account-1',
      mockWrappedRumorIds[0],
      [SELF, PEER_A, PEER_B].map((recipient) => ({
        recipientPubkey: recipient,
        wrapId: `wrap-${recipient}`
      }))
    )
  })

  it('reports delivered and failed devices on a partial send', async () => {
    mockPublishFailures.add(PEER_B)

    const error = await sendDeviceDM(account, 'hello').catch(
      (error: unknown) => error
    )

    expect(error).toBeInstanceOf(NostrPartialSendError)
    expect(error).toMatchObject({
      delivered: [SELF, PEER_A],
      failed: [PEER_B]
    })
  })

  it('retries only the devices that failed', async () => {
    await sendDevicePSBT(account, 'cHNidP8=', { onlyDevices: [PEER_B] })

    expect(mockPublished).toStrictEqual([PEER_B])
  })

  it('marks every device failed when no relay connects', async () => {
    mockConnect.mockRejectedValue(new NostrNoRelaysError('offline'))

    const error = await sendDeviceDM(account, 'hello').catch(
      (error: unknown) => error
    )

    expect(error).toMatchObject({
      delivered: [],
      failed: [SELF, PEER_A, PEER_B]
    })
    expect(error).toHaveProperty('cause', expect.any(NostrNoRelaysError))
  })
})
