import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { useNip46Connect } from '@/hooks/useNip46Connect'
import { startNip46Session } from '@/hooks/useNip46SessionManager'
import { useNip46Store } from '@/store/nip46'
import { canNostrIdentitySignRemotely } from '@/utils/nip46'

// The shared manual mock stubs nip19, which the nsec and npub round trip uses.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

jest.mock<Partial<typeof import('@/hooks/useNip46SessionManager')>>(
  '@/hooks/useNip46SessionManager',
  () => {
    const startSession = jest.fn()
    return {
      __esModule: true,
      startNip46Session: startSession,
      useNip46SessionManager: () => ({
        approveRequest: jest.fn(),
        isSessionActive: jest.fn(),
        rejectRequest: jest.fn(),
        startSession,
        stopAllSessions: jest.fn(),
        stopSession: jest.fn()
      })
    }
  }
)

const CONNECT_URI = `nostrconnect://${'c'.repeat(64)}?relay=wss%3A%2F%2Frelay.example&secret=s&name=App`

type Nip46Connect = ReturnType<typeof useNip46Connect>

function renderConnect(signerNpub: string, nsec: string) {
  const result: { current: Nip46Connect | null } = { current: null }
  function Harness() {
    result.current = useNip46Connect(signerNpub, nsec)
    return null
  }
  act(() => {
    create(createElement(Harness))
  })
  return result
}

async function connect(signerNpub: string, nsec: string) {
  const hook = renderConnect(signerNpub, nsec)
  const session = await act(() => hook.current?.initiateConnection(CONNECT_URI))
  return session ?? null
}

function storedSessionCount() {
  return useNip46Store.getState().sessions.length
}

describe('useNip46Connect', () => {
  const secretKey = generateSecretKey()
  const npub = nip19.npubEncode(getPublicKey(secretKey))
  const nsec = nip19.nsecEncode(secretKey)

  beforeEach(() => {
    jest.mocked(startNip46Session).mockReset()
    useNip46Store.getState().clearAll()
  })

  it('stores no app card when a watch-only identity is asked to connect', async () => {
    const session = await connect(npub, '')

    expect(session).toBeNull()
    expect(storedSessionCount()).toBe(0)
    expect(startNip46Session).not.toHaveBeenCalled()
  })

  it('stores no app card when the key does not sign for the identity', async () => {
    const otherNsec = nip19.nsecEncode(generateSecretKey())

    const session = await connect(npub, otherNsec)

    expect(session).toBeNull()
    expect(storedSessionCount()).toBe(0)
    expect(startNip46Session).not.toHaveBeenCalled()
  })

  it('starts the session for an identity that holds its key', async () => {
    jest.mocked(startNip46Session).mockResolvedValue()

    const session = await connect(npub, nsec)

    expect(session?.signerNpub).toBe(npub)
    expect(storedSessionCount()).toBe(1)
    expect(startNip46Session).toHaveBeenCalledWith(session, nsec)
  })
})

describe('canNostrIdentitySignRemotely', () => {
  it('needs an identity that holds its secret key', () => {
    expect(
      canNostrIdentitySignRemotely({ isWatchOnly: false, nsec: 'nsec1' })
    ).toBe(true)
    expect(
      canNostrIdentitySignRemotely({ isWatchOnly: true, nsec: 'nsec1' })
    ).toBe(false)
    expect(canNostrIdentitySignRemotely({ isWatchOnly: false })).toBe(false)
    expect(canNostrIdentitySignRemotely(undefined)).toBe(false)
  })
})
