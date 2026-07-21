import { isNativeAvailable } from 'react-native-payjoin'

import { createReceivePayjoinSession } from '@/api/payjoin'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { hasPayjoinParam } from '@/utils/payjoinUri'

describe('payjoin scaffold (phase 0)', () => {
  beforeEach(() => {
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('loads react-native-payjoin mock', () => {
    expect(isNativeAvailable()).toBe(true)
  })

  it('creates a receiver session with pj URI and persists it', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'acct-1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      amountSats: 10_000,
      label: 'phase0'
    })

    expect(session.role).toBe('receiver')
    expect(session.status).toBe('ready')
    expect(hasPayjoinParam(session.uri)).toBe(true)
    expect(session.uri).toContain('pjos=0')
    expect(session.nativeState).toBeTruthy()

    const stored = usePayjoinSessionsStore
      .getState()
      .getActiveReceiverSession('acct-1')
    expect(stored?.id).toBe(session.id)
  })
})
