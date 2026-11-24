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
import type { Nip46IncomingRequest, Nip46Session } from '@/types/models/Nostr'
import { createBunkerOffer } from '@/utils/nip46Bunker'

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

  describe('bunker offers', () => {
    afterEach(() => {
      teardownAllNip46Sessions()
    })

    type OfferHandlers = {
      onOfferRequest: (request: Nip46IncomingRequest, client: string) => boolean
      onRequest: (request: Nip46IncomingRequest) => void
    }

    async function startOffer() {
      const signerSecretKey = generateSecretKey()
      const signerHex = getPublicKey(signerSecretKey)
      const { session } = createBunkerOffer({
        nowMs: Date.now(),
        origin: { kind: 'chat', peerPubkey: 'b'.repeat(64), sessionId: '' },
        relays: ['wss://relay.example'],
        signerNpub: nip19.npubEncode(signerHex),
        signerPubkeyHex: signerHex
      })
      const stored = useNip46Store.getState().addSession(session)
      const captured: { handlers?: OfferHandlers } = {}
      jest
        .spyOn(Nip46BunkerService.prototype, 'connect')
        .mockResolvedValue(undefined)
      jest
        .spyOn(Nip46BunkerService.prototype, 'sendResponse')
        .mockResolvedValue(undefined)
      jest
        .spyOn(Nip46BunkerService.prototype, 'subscribeToOffer')
        .mockImplementation((_hex, _key, onOfferRequest, onRequest) => {
          captured.handlers = { onOfferRequest, onRequest }
        })
      await startNip46Session(stored, nip19.nsecEncode(signerSecretKey))
      return { captured, session: stored, signerHex }
    }

    function storedSession(id: string) {
      return useNip46Store.getState().sessions.find((s) => s.id === id)
    }

    it('lets the first client with the secret claim the offer, once', async () => {
      const { captured, session, signerHex } = await startOffer()
      const client = 'c'.repeat(64)
      const connect = {
        id: 'r1',
        method: 'connect',
        params: [signerHex, session.secret ?? '']
      }

      expect(captured.handlers?.onOfferRequest(connect, client)).toBe(true)
      expect(storedSession(session.id)).toMatchObject({ clientPubkey: client })
      expect(storedSession(session.id)?.secret).toBeUndefined()
      expect(captured.handlers?.onOfferRequest(connect, 'd'.repeat(64))).toBe(
        false
      )
    })

    it('ignores a client without the secret', async () => {
      const { captured, session, signerHex } = await startOffer()

      expect(
        captured.handlers?.onOfferRequest(
          { id: 'r1', method: 'connect', params: [signerHex, 'wrong'] },
          'c'.repeat(64)
        )
      ).toBe(false)
      expect(storedSession(session.id)?.clientPubkey).toBe('')
    })

    it('queues requests from the claimed client for approval', async () => {
      const { captured, session, signerHex } = await startOffer()
      captured.handlers?.onOfferRequest(
        {
          id: 'r1',
          method: 'connect',
          params: [signerHex, session.secret ?? '']
        },
        'c'.repeat(64)
      )

      captured.handlers?.onRequest({
        id: 'r2',
        method: 'sign_event',
        params: ['{}']
      })

      expect(useNip46Store.getState().pendingRequests).toMatchObject([
        { id: 'r2', sessionId: session.id }
      ])
    })

    it('forgets offers nobody claimed when sessions are restored', async () => {
      const { session } = await startOffer()

      useNip46Store.getState().markSessionsDisconnected()

      expect(storedSession(session.id)).toBeUndefined()
    })

    it('never auto-approves for a signer lent to an agent', async () => {
      const { captured, session, signerHex } = await startOffer()
      useNip46Store
        .getState()
        .updatePermission(session.id, 'sign_event', 'always_allow')
      captured.handlers?.onOfferRequest(
        {
          id: 'r1',
          method: 'connect',
          params: [signerHex, session.secret ?? '']
        },
        'c'.repeat(64)
      )

      captured.handlers?.onRequest({
        id: 'r2',
        method: 'sign_event',
        params: [
          JSON.stringify({ content: '', created_at: 1, kind: 1, tags: [] })
        ]
      })

      expect(useNip46Store.getState().pendingRequests).toMatchObject([
        { id: 'r2' }
      ])
    })
  })
})
