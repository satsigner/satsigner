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

  it('strips heavy blobs when a session becomes terminal', () => {
    const session = buildNewSession({
      accountId: 'a1',
      address: 'tb1qtest',
      nativeState: 'opaque-state',
      originalPsbtBase64: 'cHNidP8BAHUCAAAAA',
      payjoinPsbtBase64: 'cHNidP8BAHUCAAAAB',
      pjEndpoint: 'https://payjo.in/x',
      pjos: 0,
      proposalPsbtBase64: 'cHNidP8BAHUCAAAAC',
      protocol: 'v2',
      role: 'receiver',
      status: 'proposal_received',
      uri: 'bitcoin:tb1qtest?pj=https://payjo.in/x'
    })
    const store = usePayjoinSessionsStore.getState()
    store.upsertSession(session)
    store.updateSessionStatus(session.id, 'completed', {
      payjoinPsbtBase64: 'cHNidP8BAHUCAAAAD'
    })
    const updated = store.getSession(session.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.nativeState).toBeUndefined()
    expect(updated?.originalPsbtBase64).toBeUndefined()
    expect(updated?.proposalPsbtBase64).toBeUndefined()
    expect(updated?.payjoinPsbtBase64).toBeUndefined()
  })

  it('clearExpiredSessions drops expired terminal sessions', () => {
    const store = usePayjoinSessionsStore.getState()
    const alive = buildNewSession({
      accountId: 'a1',
      address: 'tb1qalive',
      nativeState: 'keep-me',
      pjEndpoint: 'https://payjo.in/alive',
      pjos: 0,
      protocol: 'v2',
      role: 'receiver',
      status: 'ready',
      uri: 'bitcoin:tb1qalive?pj=https://payjo.in/alive'
    })
    const expired = {
      ...buildNewSession({
        accountId: 'a1',
        address: 'tb1qdead',
        nativeState: 'drop-me',
        originalPsbtBase64: 'cHNidP8=',
        pjEndpoint: 'https://payjo.in/dead',
        pjos: 0,
        protocol: 'v2',
        role: 'receiver',
        status: 'completed',
        uri: 'bitcoin:tb1qdead?pj=https://payjo.in/dead'
      }),
      expiresAt: Date.now() - 1
    }
    store.upsertSession(alive)
    store.upsertSession(expired)
    store.clearExpiredSessions()
    expect(store.getSession(alive.id)?.nativeState).toBe('keep-me')
    expect(store.getSession(expired.id)).toBeUndefined()
  })
})
