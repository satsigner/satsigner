import { sendDeviceDM, sendDevicePSBT } from '@/hooks/useNostrPublish'
import { type Account } from '@/types/models/Account'
import { NostrNoRelaysError, NostrPartialSendError } from '@/utils/errors'

const mockPublishFailures = new Set<string>()
const mockConnect = jest.fn()
const mockClose = jest.fn()
const mockPublished: string[] = []

jest.mock<typeof import('@/api/nostr')>('@/api/nostr', () => ({
  NostrAPI: jest.fn(() => ({
    closeAllSubscriptions: mockClose,
    connect: mockConnect,
    createKind1059: (_nsec: string, recipient: string) => ({ recipient }),
    publishEvent: ({ recipient }: { recipient: string }) => {
      if (mockPublishFailures.has(recipient)) {
        return Promise.reject(new Error(`relay rejected ${recipient}`))
      }
      mockPublished.push(recipient)
      return Promise.resolve()
    }
  }))
}))

jest.mock<typeof import('@/utils/nostr')>('@/utils/nostr', () => ({
  compressMessage: (payload: unknown) => JSON.stringify(payload)
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
