import { Nip46BunkerService } from '@/api/nostrNip446'
import { NOSTR_NIP46_DEFAULT_PERMISSIONS } from '@/constants/nostr'
import {
  getNip46Runtime,
  registerNip46Session,
  teardownAllNip46Sessions,
  teardownNip46Identity
} from '@/services/nip46Sessions'
import { useNip46Store } from '@/store/nip46'
import type { Nip46Session } from '@/types/models/Nostr'
import { toRestoredNip46Session } from '@/utils/nip46'

const SIGNER_A = 'npub1signera'
const SIGNER_B = 'npub1signerb'

function session(id: string, signerNpub: string): Nip46Session {
  return {
    clientPubkey: `client-${id}`,
    createdAt: 0,
    id,
    lastActiveAt: 0,
    permissions: { ...NOSTR_NIP46_DEFAULT_PERMISSIONS },
    relays: ['wss://relay.example'],
    signerNpub
  }
}

function startFakeBunker(sessionId: string) {
  const service = new Nip46BunkerService()
  const disconnect = jest.spyOn(service, 'disconnect').mockReturnValue()
  registerNip46Session(sessionId, service, new Uint8Array(32))
  return disconnect
}

describe('nip46 sessions', () => {
  beforeEach(() => {
    teardownAllNip46Sessions()
  })

  it('stops the bunker and forgets the sessions of a removed identity', () => {
    const store = useNip46Store.getState()
    store.addSession(session('a', SIGNER_A))
    store.addSession(session('b', SIGNER_B))
    const disconnectA = startFakeBunker('a')
    const disconnectB = startFakeBunker('b')

    teardownNip46Identity(SIGNER_A)

    expect(disconnectA).toHaveBeenCalledTimes(1)
    expect(disconnectB).not.toHaveBeenCalled()
    expect(getNip46Runtime('a')).toBeNull()
    expect(getNip46Runtime('b')).not.toBeNull()
    expect(useNip46Store.getState().sessions.map(({ id }) => id)).toStrictEqual(
      ['b']
    )
  })

  it('stops every bunker and clears every session on a wipe', () => {
    useNip46Store.getState().addSession(session('a', SIGNER_A))
    const disconnect = startFakeBunker('a')

    teardownAllNip46Sessions()

    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(getNip46Runtime('a')).toBeNull()
    expect(useNip46Store.getState().sessions).toStrictEqual([])
  })

  it('disconnects the previous bunker when a session starts again', () => {
    const first = startFakeBunker('a')
    startFakeBunker('a')

    expect(first).toHaveBeenCalledTimes(1)
  })

  it('returns the stored session when a known client pairs again', () => {
    const store = useNip46Store.getState()
    store.addSession(session('original', SIGNER_A))

    const repaired = store.addSession({
      ...session('fresh-uuid', SIGNER_A),
      clientPubkey: 'client-original',
      relays: ['wss://other.example']
    })

    expect(repaired.id).toBe('original')
    expect(repaired.relays).toStrictEqual(['wss://other.example'])
    expect(useNip46Store.getState().sessions).toHaveLength(1)
  })

  it('marks a session that was live before a restart as disconnected', () => {
    expect(
      toRestoredNip46Session({
        ...session('a', SIGNER_A),
        connectionStatus: 'connecting'
      }).connectionStatus
    ).toBe('disconnected')
    expect(
      toRestoredNip46Session({
        ...session('a', SIGNER_A),
        connectionStatus: 'error'
      }).connectionStatus
    ).toBe('error')
  })
})
