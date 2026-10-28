import type NDK from '@nostr-dev-kit/ndk'
import { type NDKFilter, NDKRelaySet } from '@nostr-dev-kit/ndk'
import * as nostrKinds from 'nostr-tools/kinds'

import {
  createEphemeralNdk,
  disconnectNdkPool,
  ndkRegistry
} from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import {
  connectToFirstRelay,
  getRelayHealthSnapshot,
  normalizeRelayUrl
} from '@/api/nostrRelayHealth'
import {
  DIAGNOSTIC_CACHE_SKEW_SECS,
  DIAGNOSTIC_HTTP_TIMEOUT_MS,
  DIAGNOSTIC_MAX_RELAYS_PROBED,
  DIAGNOSTIC_NDK_REGISTRY_WARN_INSTANCES,
  DIAGNOSTIC_RELAY_EOSE_TIMEOUT_MS,
  DIAGNOSTIC_RELAY_SETTLE_MS,
  DIAGNOSTIC_SLOW_CHECK_TIMEOUT_MS
} from '@/constants/diagnostics'
import {
  NOSTR_PROFILE_CACHE_TTL_SECS,
  NOSTR_PUBKEY_HEX_LENGTH
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { getDb } from '@/db/connection'
import {
  getCacheCounts,
  getCachedProfile,
  getNewestCachedTimestamp
} from '@/db/nostrCache'
import { countNostrProcessedEvents } from '@/db/nostrProcessedEvents'
import { isNip46SessionActive } from '@/hooks/useNip46SessionManager'
import {
  getNostrFollowCache,
  listMmkvKeys,
  NOSTR_FOLLOW_CACHE_PREFIX
} from '@/storage/mmkv'
import { useAccountsStore } from '@/store/accounts'
import { useNip46Store } from '@/store/nip46'
import { useNostrStore } from '@/store/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { getNostrIdentityRelays } from '@/utils/nostrContacts'
import { getChatPipelineStatus } from '@/utils/nostrChat'
import { getNostrLifecycleDiagnostics } from '@/utils/nostrLifecycle'
import { getNostrSyncDiagnostics } from '@/utils/nostrSyncService'
import { isRecord } from '@/utils/object'
import { sleep, withTimeout } from '@/utils/time'

import {
  checkNip17LiveRoundtrip,
  checkNip17Roundtrip,
  checkRelayPersistence,
  type LegacyDiagnosticResult
} from '../coreChecks'
import type {
  DiagnosticCheck,
  DiagnosticOutcome,
  DiagnosticStatus,
  DiagnosticsContext
} from '../types'

const ACCOUNT_KEYED_NOSTR_STATE = [
  'members',
  'lastProtocolEOSE',
  'lastDataExchangeEOSE',
  'trustedDevices'
]

function fromLegacy(result: LegacyDiagnosticResult): DiagnosticOutcome {
  return { lines: result.lines, status: result.ok ? 'ok' : 'fail' }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function collectRelayUrls(ctx: DiagnosticsContext): string[] {
  const accountRelays = useAccountsStore
    .getState()
    .accounts.flatMap((account) => account.nostr?.relays ?? [])
  return [
    ...new Set([...ctx.identityRelays, ...accountRelays].map(normalizeRelayUrl))
  ].slice(0, DIAGNOSTIC_MAX_RELAYS_PROBED)
}

async function measureEose(ndk: NDK, url: string): Promise<number | null> {
  const startedAt = Date.now()
  const filter: NDKFilter = {
    authors: ['0'.repeat(NOSTR_PUBKEY_HEX_LENGTH)],
    kinds: [nostrKinds.Metadata],
    limit: 1
  }
  const relaySet = NDKRelaySet.fromRelayUrls([url], ndk)
  const sub = ndk.subscribe(filter, { closeOnEose: true }, relaySet)
  const eose = new Promise<void>((resolve) => {
    sub.on('eose', () => resolve())
  })
  try {
    await withTimeout(eose, DIAGNOSTIC_RELAY_EOSE_TIMEOUT_MS)
    return Date.now() - startedAt
  } catch {
    return null
  } finally {
    sub.stop()
  }
}

type Nip11Info = { authRequired: boolean; name?: string; software?: string }

async function fetchNip11(url: string): Promise<Nip11Info | null> {
  const httpUrl = url.replace(/^ws(s?):\/\//, 'http$1://')
  const response = await withTimeout(
    fetch(httpUrl, { headers: { Accept: 'application/nostr+json' } }),
    DIAGNOSTIC_HTTP_TIMEOUT_MS
  ).catch(() => null)
  if (!response?.ok) {
    return null
  }
  const body: unknown = await response.json().catch(() => null)
  if (!isRecord(body)) {
    return null
  }
  const limitation = isRecord(body.limitation) ? body.limitation : {}
  return {
    authRequired: limitation.auth_required === true,
    name: typeof body.name === 'string' ? body.name : undefined,
    software: typeof body.software === 'string' ? body.software : undefined
  }
}

function describeNip11(info: Nip11Info | null): string {
  if (!info) {
    return 'no NIP-11 info'
  }
  const software = info.software?.split('/').at(-1)
  return [
    info.name ? `"${info.name}"` : null,
    software ?? null,
    info.authRequired ? 'auth required' : null
  ]
    .filter(Boolean)
    .join(', ')
}

function relaysStatus(answered: number, total: number): DiagnosticStatus {
  if (answered === 0) {
    return 'fail'
  }
  return answered < total ? 'warn' : 'ok'
}

const relayHealthCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrRelays',
  requiresNetwork: true,
  async run(ctx) {
    const urls = collectRelayUrls(ctx)
    if (urls.length === 0) {
      return {
        lines: [
          'Skipped because no relays are saved.',
          'Add a Nostr identity under Signer → Nostr, then pick relays on Identity relays or on the Relays button on the Nostr home screen. A Bitcoin account can also save relays under its Nostr settings.'
        ],
        status: 'skipped'
      }
    }
    const ndk = createEphemeralNdk(urls)
    try {
      await connectToFirstRelay(ndk).catch(() => undefined)
      await sleep(DIAGNOSTIC_RELAY_SETTLE_MS)
      const connected = new Set(
        ndk.pool.connectedRelays().map((relay) => normalizeRelayUrl(relay.url))
      )
      const health = new Map(
        getRelayHealthSnapshot(urls).map((entry) => [entry.url, entry])
      )
      const rows = await Promise.all(
        urls.map(async (url) => {
          const nip11 = await fetchNip11(url)
          const closedReason = health.get(url)?.lastClosedReason
          if (!connected.has(url)) {
            return {
              answered: false,
              line: `${url}: NOT CONNECTED (${describeNip11(nip11)})`
            }
          }
          const eoseMs = await measureEose(ndk, url)
          const answer =
            eoseMs === null
              ? 'no EOSE (socket open but silent)'
              : `EOSE ${eoseMs}ms`
          return {
            answered: eoseMs !== null,
            line: `${url}: ${answer}, ${describeNip11(nip11)}${
              closedReason ? `, last CLOSED: ${closedReason}` : ''
            }`
          }
        })
      )
      const answered = rows.filter((row) => row.answered).length
      return {
        lines: [
          `${answered}/${urls.length} relays answered`,
          ...rows.map((row) => row.line)
        ],
        status: relaysStatus(answered, urls.length)
      }
    } finally {
      disconnectNdkPool(ndk)
    }
  },
  timeoutMs: DIAGNOSTIC_SLOW_CHECK_TIMEOUT_MS
}

const ndkRegistryCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrConnections',
  run() {
    const instances = [...ndkRegistry.values()]
    const rows = instances.map((ndk, index) => {
      const total = ndk.pool?.relays.size ?? 0
      const connected = ndk.pool?.connectedRelays().length ?? 0
      return {
        connected,
        line: `pool ${index + 1}: ${connected}/${total} connected`
      }
    })
    const deadPools = rows.filter((row) => row.connected === 0).length
    const lines = [
      `${instances.length} shared relay pools`,
      ...rows.map((row) => row.line)
    ]
    if (instances.length > DIAGNOSTIC_NDK_REGISTRY_WARN_INSTANCES) {
      return Promise.resolve({
        lines: [...lines, 'many pools open: connections may be leaking'],
        status: 'warn'
      })
    }
    return Promise.resolve({ lines, status: deadPools > 0 ? 'warn' : 'ok' })
  }
}

const nip17Check: DiagnosticCheck = {
  category: 'nostr',
  id: 'nip17',
  run: async () => fromLegacy(await checkNip17Roundtrip())
}

const relayPersistenceCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'relayPersistence',
  requiresNetwork: true,
  run: async (ctx) =>
    fromLegacy(await checkRelayPersistence(ctx.identityRelays)),
  timeoutMs: DIAGNOSTIC_SLOW_CHECK_TIMEOUT_MS
}

const nip17LiveCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nip17Live',
  manualOnly: true,
  requiresNetwork: true,
  run: async (ctx) =>
    fromLegacy(await checkNip17LiveRoundtrip(ctx.identityRelays)),
  timeoutMs: DIAGNOSTIC_SLOW_CHECK_TIMEOUT_MS
}

function formatCursorAge(seconds: number | null): string {
  return seconds === null ? 'never' : `${seconds}s ago`
}

const nostrSyncCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrSync',
  run() {
    const accounts = getNostrSyncDiagnostics()
    const lifecycle = getNostrLifecycleDiagnostics()
    const lifecycleLine = `lifecycle ${lifecycle.running ? 'running' : 'stopped'}, ${lifecycle.handlerCount} handlers, last resume ${
      lifecycle.lastResume
        ? `${Math.round((Date.now() - lifecycle.lastResume.at) / MS_PER_SECOND)}s ago`
        : 'never'
    }`
    if (accounts.length === 0) {
      return Promise.resolve({
        lines: [
          lifecycleLine,
          'Skipped because no Bitcoin account is syncing over Nostr.',
          'Add a Bitcoin account, open its Nostr settings, and turn on device sync.'
        ],
        status: 'skipped'
      })
    }
    const rows = accounts.map((sync, index) => {
      const purposes = sync.activeSubscriptionKeys.map((key) =>
        key.slice(0, key.indexOf(':'))
      )
      const duplicated = purposes.length !== new Set(purposes).size
      return {
        duplicated,
        failed: sync.status === 'error',
        line: `account ${index + 1}: ${sync.status}${
          sync.lastErrorCode ? ` (${sync.lastErrorCode})` : ''
        }, queue ${sync.queueLength}, subs ${sync.activeSubscriptionKeys.length}${
          duplicated ? ' DUPLICATED' : ''
        }, protocol cursor ${formatCursorAge(sync.eoseCursorAges.protocol)}, data cursor ${formatCursorAge(sync.eoseCursorAges.dataExchange)}`
      }
    })
    const status: DiagnosticStatus = rows.some(
      (row) => row.duplicated || row.failed
    )
      ? 'fail'
      : 'ok'
    return Promise.resolve({
      lines: [lifecycleLine, ...rows.map((row) => row.line)],
      status
    })
  }
}

const nostrChatPipelineCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrChatPipeline',
  run() {
    const { identities } = useNostrIdentityStore.getState()
    if (identities.length === 0) {
      return Promise.resolve({
        lines: [
          'Skipped because there is no Nostr identity.',
          'Add one under Signer → Nostr, then open it so chat can connect.'
        ],
        status: 'skipped'
      })
    }
    const statuses = identities.map((identity) =>
      getChatPipelineStatus(identity.npub)
    )
    const lines = statuses.map(
      (pipeline, index) =>
        `identity ${index + 1}: chat ${pipeline.state}${
          pipeline.errorCode ? ` (${pipeline.errorCode})` : ''
        }`
    )
    const failed = statuses.some((pipeline) => pipeline.state === 'error')
    return Promise.resolve({ lines, status: failed ? 'fail' : 'ok' })
  }
}

function activeIdentityHex(): string | null {
  const npub = useNostrIdentityStore.getState().activeIdentityNpub
  return npub ? getPubKeyHexFromNpub(npub) : null
}

const nostrFollowsCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrFollows',
  requiresNetwork: true,
  async run(ctx) {
    const { activeIdentityNpub, identities } = useNostrIdentityStore.getState()
    const identity =
      identities.find((item) => item.npub === activeIdentityNpub) ??
      identities[0]
    if (!identity) {
      return {
        lines: [
          'Skipped because there is no Nostr identity.',
          'Add one under Signer → Nostr. The follow list is read for that identity.'
        ],
        status: 'skipped'
      }
    }
    const relays = getNostrIdentityRelays(identity.relays, ctx.identityRelays)
    const api = new NostrAPI(relays)
    try {
      const result = await api.fetchKind3FollowingPubkeys(identity.npub)
      const found = result.data.kind3Found
      return {
        lines: [
          found
            ? `kind 3 found, ${result.data.pubkeys.length} follows`
            : 'kind 3 not found on the identity relays or the indexing relays',
          `queried ${result.data.relaysQueried.length} relays, ${result.data.connectedRelayCount} connected`,
          `source ${result.source}${result.error ? ` (${result.error})` : ''}`
        ],
        status: found ? 'ok' : 'warn'
      }
    } finally {
      api.disconnect()
    }
  },
  timeoutMs: DIAGNOSTIC_SLOW_CHECK_TIMEOUT_MS
}

const nostrCacheCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrCache',
  run() {
    const ownHex = activeIdentityHex() ?? ''
    const counts = getCacheCounts(ownHex)
    const staleBefore = nowSeconds() - NOSTR_PROFILE_CACHE_TTL_SECS
    const staleProfiles =
      getDb()
        .execute<{ n: number }>(
          'SELECT COUNT(*) AS n FROM nostr_profile_cache WHERE cached_at < ?',
          [staleBefore]
        )
        .rows.item(0)?.n ?? 0
    const lines = [
      `own notes ${counts.ownNotes}, feed notes ${counts.feedNotes}`,
      `zap receipts ${counts.zapReceipts} (own ${counts.ownZaps})`,
      `profiles ${counts.profiles} (${staleProfiles} older than the refresh window)`,
      `processed nostr events ${countNostrProcessedEvents()}`
    ]
    return Promise.resolve({ lines, status: 'ok' })
  }
}

async function fetchNewestFromRelays(
  relays: string[],
  filter: NDKFilter
): Promise<number | null> {
  const ndk = createEphemeralNdk(relays)
  try {
    await connectToFirstRelay(ndk)
    const events = await withTimeout(
      ndk.fetchEvents(filter, { closeOnEose: true }),
      DIAGNOSTIC_RELAY_EOSE_TIMEOUT_MS
    )
    const newest = Math.max(0, ...[...events].map((e) => e.created_at ?? 0))
    return newest > 0 ? newest : null
  } finally {
    disconnectNdkPool(ndk)
  }
}

function compareFreshness(
  label: string,
  cachedAt: number | null,
  relayAt: number | null
): { behind: boolean; line: string } {
  if (relayAt === null) {
    return { behind: false, line: `${label}: relays have none` }
  }
  if (cachedAt === null) {
    return { behind: true, line: `${label}: not cached yet` }
  }
  const skew = relayAt - cachedAt
  if (skew > DIAGNOSTIC_CACHE_SKEW_SECS) {
    return { behind: true, line: `${label}: cache is ${skew}s behind relays` }
  }
  if (skew < -DIAGNOSTIC_CACHE_SKEW_SECS) {
    return {
      behind: false,
      line: `${label}: cache is newer than relays by ${-skew}s (relays may be missing it)`
    }
  }
  return { behind: false, line: `${label}: cache matches relays` }
}

const nostrCacheFreshnessCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrCacheFreshness',
  requiresNetwork: true,
  async run(ctx) {
    const hex = activeIdentityHex()
    if (!hex) {
      return {
        lines: [
          'Skipped because there is no Nostr identity.',
          'Add one under Signer → Nostr and open it so it becomes the active identity.'
        ],
        status: 'skipped'
      }
    }
    if (ctx.identityRelays.length === 0) {
      return {
        lines: [
          'Skipped because this identity has no relays.',
          'Open Signer → Nostr → Relays, or the identity’s Identity relays screen, and save at least one relay.'
        ],
        status: 'skipped'
      }
    }
    const [relayProfileAt, relayNoteAt] = await Promise.all([
      fetchNewestFromRelays(ctx.identityRelays, {
        authors: [hex],
        kinds: [nostrKinds.Metadata],
        limit: 1
      }),
      fetchNewestFromRelays(ctx.identityRelays, {
        authors: [hex],
        kinds: [nostrKinds.ShortTextNote],
        limit: 1
      })
    ])
    const comparisons = [
      compareFreshness(
        'profile',
        getCachedProfile(hex)?.created_at ?? null,
        relayProfileAt
      ),
      compareFreshness(
        'latest note',
        getNewestCachedTimestamp(nostrKinds.ShortTextNote, hex),
        relayNoteAt
      )
    ]
    return {
      lines: comparisons.map((comparison) => comparison.line),
      status: comparisons.some((comparison) => comparison.behind)
        ? 'warn'
        : 'ok'
    }
  },
  timeoutMs: DIAGNOSTIC_SLOW_CHECK_TIMEOUT_MS
}

function orphanAccountKeys(accountIds: Set<string>): string[] {
  const state: Record<string, unknown> = { ...useNostrStore.getState() }
  return ACCOUNT_KEYED_NOSTR_STATE.flatMap((field) => {
    const value = state[field]
    if (!isRecord(value)) {
      return []
    }
    return Object.keys(value)
      .filter((key) => !accountIds.has(key))
      .map((key) => `${field}: ${key}`)
  })
}

const nostrOrphansCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nostrOrphans',
  run() {
    const accountIds = new Set(
      useAccountsStore.getState().accounts.map((account) => account.id)
    )
    const identityNpubs = new Set(
      useNostrIdentityStore.getState().identities.map((i) => i.npub)
    )
    const orphanState = orphanAccountKeys(accountIds)
    const orphanFollows = listMmkvKeys(NOSTR_FOLLOW_CACHE_PREFIX).filter(
      (key) => !identityNpubs.has(key.slice(NOSTR_FOLLOW_CACHE_PREFIX.length))
    )
    const followCount = [...identityNpubs].reduce(
      (sum, npub) => sum + (getNostrFollowCache(npub)?.length ?? 0),
      0
    )
    const lines = [
      `${orphanState.length} sync entries for deleted accounts`,
      `${orphanFollows.length} follow caches for removed identities`,
      `${followCount} cached follows across identities`
    ]
    const hasOrphans = orphanState.length > 0 || orphanFollows.length > 0
    return Promise.resolve({ lines, status: hasOrphans ? 'warn' : 'ok' })
  }
}

const nip46SessionsCheck: DiagnosticCheck = {
  category: 'nostr',
  id: 'nip46Sessions',
  run() {
    const { sessions } = useNip46Store.getState()
    if (sessions.length === 0) {
      return Promise.resolve({
        lines: [
          'Skipped because no remote signer (NIP-46) session is saved.',
          'Connect a bunker from the identity’s bunker screen if you want this checked.'
        ],
        status: 'skipped'
      })
    }
    const active = sessions.filter((session) =>
      isNip46SessionActive(session.id)
    ).length
    return Promise.resolve({
      lines: [`${sessions.length} sessions, ${active} connected`],
      status: active < sessions.length ? 'warn' : 'ok'
    })
  }
}

const NOSTR_CHECKS = [
  relayHealthCheck,
  ndkRegistryCheck,
  nostrFollowsCheck,
  nostrSyncCheck,
  nostrChatPipelineCheck,
  nostrCacheCheck,
  nostrCacheFreshnessCheck,
  nostrOrphansCheck,
  nip46SessionsCheck,
  nip17Check,
  relayPersistenceCheck,
  nip17LiveCheck
]

export { compareFreshness, NOSTR_CHECKS }
