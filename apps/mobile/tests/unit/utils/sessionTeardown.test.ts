import { Nip46BunkerService } from '@/api/nostrNip446'
import { NOSTR_NIP46_DEFAULT_PERMISSIONS } from '@/constants/nostr'
import { releaseAllArkWalletsAndSubscriptions } from '@/services/arkWallet'
import {
  getNip46Runtime,
  registerNip46Session,
  teardownAllNip46Sessions
} from '@/services/nip46Sessions'
import { useNip46Store } from '@/store/nip46'
import {
  loadAccountNostrSecrets,
  setCachedAccountSecrets
} from '@/utils/nostrSecrets'
import { teardownUnlockedSession } from '@/utils/sessionTeardown'

jest.mock<typeof import('@/services/arkWallet')>(
  '@/services/arkWallet',
  () => ({
    ...jest.requireActual<typeof import('@/services/arkWallet')>(
      '@/services/arkWallet'
    ),
    releaseAllArkWalletsAndSubscriptions: jest.fn().mockResolvedValue(undefined)
  })
)

const SIGNER = 'npub1signer'
const SESSION_ID = 'session-a'
const SECRET_KEY_BYTE = 7

function startFakeBunker(secretKey: Uint8Array) {
  const service = new Nip46BunkerService()
  const disconnect = jest.spyOn(service, 'disconnect').mockReturnValue()
  registerNip46Session(SESSION_ID, service, secretKey)
  return disconnect
}

describe('teardownUnlockedSession', () => {
  beforeEach(() => {
    teardownAllNip46Sessions()
    jest.clearAllMocks()
  })

  it('stops every bunker and wipes its signing key', async () => {
    const secretKey = new Uint8Array(32).fill(SECRET_KEY_BYTE)
    const disconnect = startFakeBunker(secretKey)

    await teardownUnlockedSession()

    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(getNip46Runtime(SESSION_ID)).toBeNull()
    expect(secretKey.every((byte) => byte === 0)).toBe(true)
  })

  it('keeps the paired sessions but drops their unanswered requests', async () => {
    const store = useNip46Store.getState()
    store.addSession({
      clientPubkey: 'client',
      createdAt: 0,
      id: SESSION_ID,
      lastActiveAt: 0,
      permissions: { ...NOSTR_NIP46_DEFAULT_PERMISSIONS },
      relays: ['wss://relay.example'],
      signerNpub: SIGNER
    })
    store.addPendingRequest({
      id: 'request-1',
      method: 'sign_event',
      params: [],
      receivedAt: 0,
      sessionId: SESSION_ID,
      status: 'pending'
    })

    await teardownUnlockedSession()

    const state = useNip46Store.getState()
    expect(state.sessions.map(({ id }) => id)).toStrictEqual([SESSION_ID])
    expect(state.pendingRequests).toStrictEqual([])
  })

  it('forgets decrypted nostr secrets', async () => {
    setCachedAccountSecrets('account-1', { commonNsec: 'nsec1secret' })
    await expect(loadAccountNostrSecrets('account-1')).resolves.toStrictEqual({
      commonNsec: 'nsec1secret'
    })

    await teardownUnlockedSession()

    await expect(loadAccountNostrSecrets('account-1')).resolves.toBeNull()
  })

  it('releases the open Ark wallets', async () => {
    await teardownUnlockedSession()

    expect(releaseAllArkWalletsAndSubscriptions).toHaveBeenCalledTimes(1)
  })
})
