import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'

import { Nip46BunkerService } from '@/api/nostrNip446'
import { NOSTR_NIP46_DEFAULT_PERMISSIONS } from '@/constants/nostr'
import { startNip46Session } from '@/hooks/useNip46SessionManager'
import {
  getNip46Runtime,
  teardownAllNip46Sessions
} from '@/services/nip46Sessions'
import { useAuthStore } from '@/store/auth'
import { useNip46Store } from '@/store/nip46'
import type { Nip46Session } from '@/types/models/Nostr'

// The shared manual mock stubs nip19, which the nsec and npub round trip uses.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

const SESSION_ID = 'session-a'

function buildSession(signerSecretKey: Uint8Array): Nip46Session {
  return {
    clientPubkey: getPublicKey(generateSecretKey()),
    createdAt: 0,
    id: SESSION_ID,
    lastActiveAt: 0,
    permissions: { ...NOSTR_NIP46_DEFAULT_PERMISSIONS },
    relays: ['wss://relay.example'],
    signerNpub: nip19.npubEncode(getPublicKey(signerSecretKey))
  }
}

function storedStatus() {
  return useNip46Store.getState().sessions.find(({ id }) => id === SESSION_ID)
    ?.connectionStatus
}

describe('startNip46Session', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    teardownAllNip46Sessions()
    useAuthStore.setState({
      lockTriggered: false,
      requiresAuth: true,
      skipPin: false
    })
  })

  it('drops a bunker that finished connecting after the app locked', async () => {
    const signerSecretKey = generateSecretKey()
    const session = useNip46Store
      .getState()
      .addSession(buildSession(signerSecretKey))
    jest
      .spyOn(Nip46BunkerService.prototype, 'connect')
      .mockImplementation(() => {
        useAuthStore.setState({ lockTriggered: true })
        return Promise.resolve()
      })
    const disconnect = jest
      .spyOn(Nip46BunkerService.prototype, 'disconnect')
      .mockReturnValue()
    const subscribe = jest.spyOn(Nip46BunkerService.prototype, 'subscribe')

    await startNip46Session(session, nip19.nsecEncode(signerSecretKey))

    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(subscribe).not.toHaveBeenCalled()
    expect(getNip46Runtime(SESSION_ID)).toBeNull()
    expect(storedStatus()).toBe('disconnected')
  })
})
