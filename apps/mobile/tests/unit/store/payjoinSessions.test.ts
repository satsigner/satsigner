import {
  usePayjoinSessionsStore,
  buildNewSession
} from '@/store/payjoinSessions'

describe('payjoinSessions store', () => {
  beforeEach(() => {
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('upserts and retrieves active receiver sessions', () => {
    const session = buildNewSession({
      accountId: 'a1',
      address: 'tb1qtest',
      pjEndpoint: 'https://payjo.in/x',
      pjos: 0,
      protocol: 'v2',
      role: 'receiver',
      status: 'ready',
      uri: 'bitcoin:tb1qtest?pjos=0&pj=https://payjo.in/x'
    })
    usePayjoinSessionsStore.getState().upsertSession(session)
    expect(
      usePayjoinSessionsStore.getState().getActiveReceiverSession('a1')?.id
    ).toBe(session.id)
  })

  it('retrieves active sender sessions with native state', () => {
    const session = buildNewSession({
      accountId: 'sender-1',
      address: 'tb1qtest',
      nativeState: 'opaque-state',
      originalPsbtBase64: 'cHNidP8=',
      pjEndpoint: 'https://payjo.in/x',
      pjos: 0,
      protocol: 'v2',
      role: 'sender',
      status: 'waiting',
      uri: 'bitcoin:tb1qtest?pjos=0&pj=https://payjo.in/x'
    })
    usePayjoinSessionsStore.getState().upsertSession(session)
    expect(
      usePayjoinSessionsStore.getState().getActiveSenderSession('sender-1')?.id
    ).toBe(session.id)
    expect(
      usePayjoinSessionsStore.getState().getActiveSenderSession('other')
    ).toBeUndefined()
  })

  it('tracks seen inputs for replay protection', () => {
    const store = usePayjoinSessionsStore.getState()
    expect(store.hasSeenInput('aa:0')).toBe(false)
    store.markInputSeen('aa:0')
    expect(store.hasSeenInput('aa:0')).toBe(true)
  })

  it('updates session status', () => {
    const session = buildNewSession({
      accountId: 'a1',
      address: 'tb1qtest',
      pjEndpoint: 'https://example.com/pj',
      pjos: 0,
      protocol: 'v1',
      role: 'sender',
      status: 'negotiating',
      uri: 'bitcoin:tb1qtest?pj=https://example.com/pj'
    })
    const store = usePayjoinSessionsStore.getState()
    store.upsertSession(session)
    store.updateSessionStatus(session.id, 'fallback', {
      error: 'timeout'
    })
    expect(store.getSession(session.id)?.status).toBe('fallback')
    expect(store.getSession(session.id)?.error).toBe('timeout')
  })
})
