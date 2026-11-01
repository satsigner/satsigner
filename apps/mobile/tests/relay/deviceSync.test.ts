import type { Event } from 'nostr-tools'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import { NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC } from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  countNostrProcessedEvents,
  getNewestProcessedCreatedAt
} from '@/db/nostrProcessedEvents'
import { dmHandler } from '@/hooks/useNostrDMHandler'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { type NostrMsgHandlerContext } from '@/types/models/Nostr'
import { resumeNostr } from '@/utils/nostrLifecycle'
import { nostrSyncService } from '@/utils/nostrSyncService'

import { rumorIdOfWrap, wrapDeviceDm } from './support/identities'
import { resetNodeNitroSqlite } from './support/nodeNitroSqlite'
import {
  createSyncAccountKeys,
  installSyncAccount,
  storedDmIds,
  type SyncAccountKeys
} from './support/syncAccount'
import { startTestRelay, type TestRelay } from './support/testRelay'
import { delay, waitFor } from './support/waitFor'

const BACKLOG_SIZE = 500
const SMALL_BACKLOG_SIZE = 20
const RESUME_EVENT_COUNT = 3
const DROP_AFTER_EVENTS = 200
const BACKLOG_AGE_SEC = 1000
const SYNC_WAIT_MS = 15_000
const SCENARIO_TIMEOUT_MS = 120_000
const SETTLE_MS = 500
const GIFT_WRAP_KIND = 1059
const PROCESSED_ROWS_PER_EVENT = 2
const SYNC_PURPOSE_COUNT = 2

type Backlog = {
  keys: SyncAccountKeys
  wraps: Event[]
  createdAts: number[]
  newestCreatedAt: number
}

function nowSec() {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function createBacklog(size: number): Backlog {
  const keys = createSyncAccountKeys()
  const base = nowSec() - BACKLOG_AGE_SEC
  const createdAts = Array.from({ length: size }, (_, index) => base + index)
  const wraps = createdAts.map((createdAt, index) =>
    wrapDeviceDm(keys.peerDevice, keys.device, createdAt, `dm ${index}`)
  )
  return { createdAts, keys, newestCreatedAt: base + size - 1, wraps }
}

function dataExchangeCursor(accountId: string) {
  return useNostrStore.getState().getLastDataExchangeEOSE(accountId)
}

async function waitForCursor(accountId: string, expected: number) {
  await waitFor(() => dataExchangeCursor(accountId) === expected, {
    timeoutMs: SYNC_WAIT_MS
  }).catch(() => undefined)
  expect(dataExchangeCursor(accountId)).toBe(expected)
}

/** Counts how often the DM handler ran per rumor id; can fail chosen ids. */
function trackHandledRumors() {
  const original = dmHandler.handle
  const counts = new Map<string, number>()
  const failing = new Set<string>()
  jest
    .spyOn(dmHandler, 'handle')
    .mockImplementation((context: NostrMsgHandlerContext) => {
      const { id } = context.unwrappedEvent
      counts.set(id, (counts.get(id) ?? 0) + 1)
      if (failing.has(id)) {
        throw new Error('handler failure under test')
      }
      return original(context)
    })
  return { counts, failing }
}

function handledExactlyOnce(counts: Map<string, number>) {
  return [...counts.values()].every((count) => count === 1)
}

function giftWrapReqs(relay: TestRelay) {
  return relay
    .reqLog()
    .filter(({ filters }) =>
      filters.some((filter) => filter.kinds?.includes(GIFT_WRAP_KIND))
    )
}

describe('device sync against the test relay', () => {
  const state: { relay?: TestRelay; nextAccount: number } = { nextAccount: 1 }
  const shared: { backlog?: Backlog } = {}

  function relay() {
    if (!state.relay) {
      throw new Error('relay not started')
    }
    return state.relay
  }

  function largeBacklog() {
    shared.backlog ??= createBacklog(BACKLOG_SIZE)
    return shared.backlog
  }

  function newAccount(keys: SyncAccountKeys) {
    const id = `relay-sync-${state.nextAccount}`
    state.nextAccount += 1
    return installSyncAccount(id, keys, [relay().url])
  }

  beforeEach(async () => {
    resetRelayHealth()
    state.relay = await startTestRelay()
  })

  afterEach(async () => {
    await nostrSyncService.stopAll()
    nostrSyncService.resetInstance()
    clearNdkRegistry()
    await state.relay?.stop()
    jest.restoreAllMocks()
  })

  afterAll(() => {
    resetNodeNitroSqlite()
  })

  it(
    'processes a 500 event backlog exactly once and parks the cursor on the newest rumor',
    async () => {
      const backlog = largeBacklog()
      relay().seed(backlog.wraps)
      const account = newAccount(backlog.keys)
      const handled = trackHandledRumors()

      await nostrSyncService.startSync(account.id)
      await waitForCursor(account.id, backlog.newestCreatedAt)
      await delay(SETTLE_MS)

      const dmIds = storedDmIds(account.id)
      expect(dmIds).toHaveLength(BACKLOG_SIZE)
      expect(new Set(dmIds).size).toBe(BACKLOG_SIZE)
      expect(handled.counts.size).toBe(BACKLOG_SIZE)
      expect(handledExactlyOnce(handled.counts)).toBe(true)
      expect(countNostrProcessedEvents(account.id)).toBe(
        BACKLOG_SIZE * PROCESSED_ROWS_PER_EVENT
      )
      expect(getNewestProcessedCreatedAt(account.id)).toBe(
        dataExchangeCursor(account.id)
      )
    },
    SCENARIO_TIMEOUT_MS
  )

  async function syncWithOneFailingHandler() {
    const backlog = createBacklog(SMALL_BACKLOG_SIZE)
    relay().seed(backlog.wraps)
    const account = newAccount(backlog.keys)
    const handled = trackHandledRumors()
    const failingIndex = SMALL_BACKLOG_SIZE / 2
    const failingWrap = backlog.wraps.at(failingIndex)
    const failingCreatedAt = backlog.createdAts.at(failingIndex) ?? 0
    const failingRumorId = failingWrap
      ? rumorIdOfWrap(failingWrap, backlog.keys.device)
      : ''
    handled.failing.add(failingRumorId)

    await nostrSyncService.startSync(account.id)
    await waitForCursor(account.id, failingCreatedAt - 1)
    await delay(SETTLE_MS)
    const firstSync = {
      dmIds: storedDmIds(account.id),
      processedRows: countNostrProcessedEvents(account.id)
    }

    handled.failing.clear()
    await nostrSyncService.restartSync(account.id)
    await waitFor(() => handled.counts.get(failingRumorId) === 2, {
      label: 'retried event handled',
      timeoutMs: SYNC_WAIT_MS
    })
    await waitFor(
      () => (dataExchangeCursor(account.id) ?? 0) >= failingCreatedAt,
      { label: 'cursor past the retried event', timeoutMs: SYNC_WAIT_MS }
    )
    return {
      account,
      backlog,
      failingRumorId,
      firstSync,
      handled
    }
  }

  it(
    'leaves an event whose handler throws unprocessed and processes it on the next sync',
    async () => {
      const { account, failingRumorId, firstSync, handled } =
        await syncWithOneFailingHandler()

      expect(firstSync.dmIds).toHaveLength(SMALL_BACKLOG_SIZE - 1)
      expect(firstSync.dmIds).not.toContain(failingRumorId)
      expect(firstSync.processedRows).toBe(
        (SMALL_BACKLOG_SIZE - 1) * PROCESSED_ROWS_PER_EVENT
      )
      expect(storedDmIds(account.id)).toHaveLength(SMALL_BACKLOG_SIZE)
      expect(storedDmIds(account.id)).toContain(failingRumorId)
      expect(countNostrProcessedEvents(account.id)).toBe(
        SMALL_BACKLOG_SIZE * PROCESSED_ROWS_PER_EVENT
      )
      handled.counts.delete(failingRumorId)
      expect(handledExactlyOnce(handled.counts)).toBe(true)
    },
    SCENARIO_TIMEOUT_MS
  )

  it(
    'moves the cursor to the newest processed rumor once the retried event succeeds',
    async () => {
      const { account, backlog } = await syncWithOneFailingHandler()
      await delay(SETTLE_MS)

      expect(dataExchangeCursor(account.id)).toBe(backlog.newestCreatedAt)
      expect(getNewestProcessedCreatedAt(account.id)).toBe(
        backlog.newestCreatedAt
      )
    },
    SCENARIO_TIMEOUT_MS
  )

  it(
    'loses and duplicates nothing when the socket drops mid-sync and the service restarts',
    async () => {
      const backlog = largeBacklog()
      relay().seed(backlog.wraps)
      const account = newAccount(backlog.keys)
      const handled = trackHandledRumors()
      relay().setFault({ events: DROP_AFTER_EVENTS, type: 'dropAfter' })

      await nostrSyncService.startSync(account.id)
      await waitFor(() => handled.counts.size > 0, {
        label: 'events handled before the drop',
        timeoutMs: SYNC_WAIT_MS
      })
      await nostrSyncService.stopSync(account.id)

      expect(handled.counts.size).toBeLessThan(BACKLOG_SIZE)
      expect(dataExchangeCursor(account.id)).toBeUndefined()

      relay().setFault(null)
      await nostrSyncService.startSync(account.id)
      await waitFor(
        () =>
          dataExchangeCursor(account.id) !== undefined &&
          storedDmIds(account.id).length === BACKLOG_SIZE,
        { label: 'backlog after restart', timeoutMs: SYNC_WAIT_MS }
      )
      await delay(SETTLE_MS)

      expect(dataExchangeCursor(account.id)).toBe(backlog.newestCreatedAt)

      const dmIds = storedDmIds(account.id)
      expect(dmIds).toHaveLength(BACKLOG_SIZE)
      expect(new Set(dmIds).size).toBe(BACKLOG_SIZE)
      expect(handled.counts.size).toBe(BACKLOG_SIZE)
      expect(handledExactlyOnce(handled.counts)).toBe(true)
      expect(countNostrProcessedEvents(account.id)).toBe(
        BACKLOG_SIZE * PROCESSED_ROWS_PER_EVENT
      )
    },
    SCENARIO_TIMEOUT_MS
  )

  async function syncThenMissEvents() {
    const backlog = createBacklog(SMALL_BACKLOG_SIZE)
    relay().seed(backlog.wraps)
    const account = newAccount(backlog.keys)
    const handled = trackHandledRumors()

    await nostrSyncService.startSync(account.id)
    await waitForCursor(account.id, backlog.newestCreatedAt)
    await delay(SETTLE_MS)
    const cursor = backlog.newestCreatedAt
    const reqsBeforeResume = giftWrapReqs(relay()).length

    relay().disconnectAll()
    for (let index = 1; index <= RESUME_EVENT_COUNT; index += 1) {
      relay().inject(
        wrapDeviceDm(
          backlog.keys.peerDevice,
          backlog.keys.device,
          cursor + index,
          `missed ${index}`
        )
      )
    }

    async function expectOnlyMissedEventsFetched() {
      await waitForCursor(account.id, cursor + RESUME_EVENT_COUNT)
      await delay(SETTLE_MS)
      const resumeSinces = giftWrapReqs(relay())
        .slice(reqsBeforeResume)
        .flatMap(({ filters }) => filters.map((filter) => filter.since))
      expect(resumeSinces).toContain(
        cursor - NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
      )
      expect(storedDmIds(account.id)).toHaveLength(
        SMALL_BACKLOG_SIZE + RESUME_EVENT_COUNT
      )
      expect(handled.counts.size).toBe(SMALL_BACKLOG_SIZE + RESUME_EVENT_COUNT)
      expect(handledExactlyOnce(handled.counts)).toBe(true)
    }

    return { account, expectOnlyMissedEventsFetched }
  }

  it(
    'a restart after a dead socket catches up from the cursor with only the missed events',
    async () => {
      const { account, expectOnlyMissedEventsFetched } =
        await syncThenMissEvents()

      await nostrSyncService.restartSync(account.id)

      await expectOnlyMissedEventsFetched()
    },
    SCENARIO_TIMEOUT_MS
  )

  it(
    'resumeNostr catches up from the cursor after the socket dropped',
    async () => {
      const { expectOnlyMissedEventsFetched } = await syncThenMissEvents()

      await resumeNostr()

      await expectOnlyMissedEventsFetched()
    },
    SCENARIO_TIMEOUT_MS
  )

  it(
    'keeps one REQ per purpose across repeated starts and account edits',
    async () => {
      const backlog = createBacklog(1)
      relay().seed(backlog.wraps)
      const account = newAccount(backlog.keys)

      await Promise.all([
        nostrSyncService.startSync(account.id),
        nostrSyncService.startSync(account.id)
      ])
      useAccountsStore
        .getState()
        .updateAccountNostr(account.id, { deviceDisplayName: 'renamed' })
      await nostrSyncService.startSync(account.id)
      await waitForCursor(account.id, backlog.newestCreatedAt)
      await delay(SETTLE_MS)

      const openSubIds = relay()
        .openSubscriptions()
        .flatMap(({ subIds }) => subIds)
      const reqs = giftWrapReqs(relay())
      const recipients = reqs.flatMap(({ filters }) =>
        filters.flatMap((filter) => filter['#p'] ?? [])
      )
      expect(openSubIds).toHaveLength(SYNC_PURPOSE_COUNT)
      expect(reqs).toHaveLength(SYNC_PURPOSE_COUNT)
      expect(recipients.toSorted()).toStrictEqual(
        [backlog.keys.common.pubkey, backlog.keys.device.pubkey].toSorted()
      )
    },
    SCENARIO_TIMEOUT_MS
  )
})
