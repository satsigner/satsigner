import {
  PAYJOIN_DIRECTORY_URL,
  PAYJOIN_SESSION_TTL_MS,
  PAYJOIN_SESSION_TTL_PRESETS_MS
} from '@/constants/payjoin'
import {
  getPayjoinDeps,
  usePayjoinSessionsStore
} from '@/store/payjoinSessions'
import { useSettingsStore } from '@/store/settings'
import { buildNewSession } from '@/utils/payjoinSession'

const TTL_MS = 600_000
const CUSTOM_DIRECTORY_URL = 'https://pj.example.com'
const NON_PRESET_TTL_MS = 42

const initialSettings = useSettingsStore.getState()

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
      ttlMs: TTL_MS,
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
      ttlMs: TTL_MS,
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
      ttlMs: TTL_MS,
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
      ttlMs: TTL_MS,
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
      ttlMs: TTL_MS,
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
        ttlMs: TTL_MS,
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

describe('getPayjoinDeps', () => {
  afterEach(() => {
    useSettingsStore.setState(initialSettings, true)
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('uses the default directory when no custom one is set', () => {
    useSettingsStore.setState({ payjoinDirectoryUrl: '  ' })

    const { settings } = getPayjoinDeps()

    expect(settings.directoryUrl).toBe(PAYJOIN_DIRECTORY_URL)
    expect(settings.hasCustomDirectory).toBe(false)
  })

  it('flags a custom directory so a failure never falls back to the default', () => {
    useSettingsStore.setState({
      payjoinDirectoryUrl: `${CUSTOM_DIRECTORY_URL}/`
    })

    const { settings } = getPayjoinDeps()

    expect(settings.directoryUrl).toBe(CUSTOM_DIRECTORY_URL)
    expect(settings.hasCustomDirectory).toBe(true)
  })

  it('keeps a session TTL preset', () => {
    const [shortestPreset] = PAYJOIN_SESSION_TTL_PRESETS_MS
    useSettingsStore.setState({ payjoinSessionTtlMs: shortestPreset })

    expect(getPayjoinDeps().settings.sessionTtlMs).toBe(shortestPreset)
  })

  it('replaces a session TTL outside the presets with the default', () => {
    useSettingsStore.setState({ payjoinSessionTtlMs: NON_PRESET_TTL_MS })

    expect(getPayjoinDeps().settings.sessionTtlMs).toBe(PAYJOIN_SESSION_TTL_MS)
  })

  it('writes sessions and seen inputs through to the persisted store', () => {
    const { sessions } = getPayjoinDeps()
    const session = buildNewSession({
      accountId: 'a1',
      address: 'tb1qtest',
      pjEndpoint: 'https://payjo.in/x',
      pjos: 0,
      protocol: 'v2',
      role: 'receiver',
      status: 'ready',
      ttlMs: TTL_MS,
      uri: 'bitcoin:tb1qtest?pjos=0&pj=https://payjo.in/x'
    })

    sessions.upsertSession(session)
    sessions.markInputSeen('aa:0')

    const store = usePayjoinSessionsStore.getState()
    expect(store.getSession(session.id)?.id).toBe(session.id)
    expect(store.hasSeenInput('aa:0')).toBe(true)
    expect(sessions.getSessions()).toStrictEqual(store.sessions)
  })
})
