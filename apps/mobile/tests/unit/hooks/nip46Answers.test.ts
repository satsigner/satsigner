import {
  approveNip46Request,
  rejectNip46Request
} from '@/hooks/useNip46SessionManager'
import { getNip46Runtime } from '@/services/nip46Sessions'
import { useNip46Store } from '@/store/nip46'
import type { Nip46Request } from '@/types/models/Nostr'

jest.mock<Partial<typeof import('@/api/nostrNip446')>>(
  '@/api/nostrNip446',
  () => ({ Nip46BunkerService: jest.fn(), __esModule: true })
)

jest.mock<Partial<typeof import('@/services/nip46Sessions')>>(
  '@/services/nip46Sessions',
  () => ({
    __esModule: true,
    getNip46Runtime: jest.fn(),
    isNip46SessionActive: jest.fn(),
    registerNip46Session: jest.fn(),
    stopAllNip46Sessions: jest.fn(),
    stopNip46Session: jest.fn()
  })
)

jest.mock<Partial<typeof import('@/utils/nostr')>>('@/utils/nostr', () => ({
  __esModule: true,
  getPubKeyHexFromNpub: jest.fn(() => 'signer-hex'),
  getSecretFromNsec: jest.fn()
}))

const SESSION_ID = 'session-1'
const sendResponse = jest.fn()

function pendingRequest(id: string): Nip46Request {
  return {
    id,
    method: 'ping',
    params: [],
    receivedAt: 0,
    sessionId: SESSION_ID,
    status: 'pending'
  }
}

function pendingRequestIds() {
  return useNip46Store.getState().pendingRequests.map(({ id }) => id)
}

function permissionFor(method: Nip46Request['method']) {
  return useNip46Store.getState().sessions[0].permissions[method]
}

describe('answering NIP-46 requests', () => {
  beforeEach(() => {
    useNip46Store.getState().clearAll()
    useNip46Store.getState().addSession({
      clientPubkey: 'client-hex',
      createdAt: 0,
      id: SESSION_ID,
      lastActiveAt: 0,
      permissions: {},
      relays: ['wss://relay.example'],
      signerNpub: 'npub1signer'
    })
    jest.mocked(getNip46Runtime).mockReturnValue({
      secretKey: new Uint8Array(32),
      service: { sendResponse }
    })
    sendResponse.mockReset()
  })

  it('keeps an approved request when its answer cannot be sent', async () => {
    useNip46Store.getState().addPendingRequest(pendingRequest('a'))
    sendResponse.mockRejectedValue(new Error('relay down'))

    await expect(approveNip46Request('a', false)).resolves.toBe('failed')

    expect(pendingRequestIds()).toStrictEqual(['a'])
  })

  it('drops a rejected request even when its answer cannot be sent', async () => {
    useNip46Store.getState().addPendingRequest(pendingRequest('b'))
    sendResponse.mockRejectedValue(new Error('relay down'))

    await expect(rejectNip46Request('b', false)).resolves.toBe('failed')

    expect(pendingRequestIds()).toStrictEqual([])
  })

  it('skips a second answer while the first is being sent', async () => {
    useNip46Store.getState().addPendingRequest(pendingRequest('c'))
    sendResponse.mockResolvedValue(undefined)

    const approving = approveNip46Request('c', false)
    const rejecting = rejectNip46Request('c', true)

    await expect(rejecting).resolves.toBe('skipped')
    await expect(approving).resolves.toBe('sent')
    expect(sendResponse).toHaveBeenCalledTimes(1)
    expect(permissionFor('ping')).toBeUndefined()
    expect(pendingRequestIds()).toStrictEqual([])
  })
})
