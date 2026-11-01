import { once } from 'node:events'

import type { Event, Filter } from 'nostr-tools'
import { verifyEvent } from 'nostr-tools/pure'
import { type WebSocket, WebSocketServer } from 'ws'

const RELAY_HOST = '127.0.0.1'
const RANDOM_PORT = 0
const REFUSED_STATUS_CODE = 503
const DELETION_KIND = 5
const METADATA_KIND = 0
const CONTACTS_KIND = 3
const REPLACEABLE_RANGE = { max: 19_999, min: 10_000 }
const ADDRESSABLE_RANGE = { max: 39_999, min: 30_000 }
const SINGLE_LETTER_TAG_KEY_LENGTH = 2

type RelayFault =
  | { type: 'refuse' }
  | { type: 'neverEose' }
  | { type: 'delayEose'; ms: number }
  | { type: 'dropAfter'; events: number }
  | { type: 'closed'; reason: string }
  | { type: 'rejectPublish'; reason: string }

type ReqLogEntry = {
  connectionId: number
  subId: string
  filters: Filter[]
  at: number
}

type OpenSubscriptions = {
  connectionId: number
  subIds: string[]
}

type TestRelayOptions = {
  verifySignatures?: boolean
}

type TestRelay = {
  url: string
  stop: () => Promise<void>
  seed: (events: Event[]) => void
  inject: (event: Event) => void
  events: () => Event[]
  reqLog: () => ReqLogEntry[]
  openSubscriptions: () => OpenSubscriptions[]
  setFault: (fault: RelayFault | null) => void
  connectionCount: () => number
  disconnectAll: () => void
}

type Connection = {
  id: number
  socket: WebSocket
  subscriptions: Map<string, Filter[]>
  sentEvents: number
}

type StoreResult = { accepted: true } | { accepted: false; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isStringArray(value)
}

function isOptionalNumberArray(value: unknown): value is number[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'number'))
  )
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number'
}

function isTagKey(key: string): key is `#${string}` {
  return key.startsWith('#') && key.length === SINGLE_LETTER_TAG_KEY_LENGTH
}

function isNostrEvent(value: unknown): value is Event {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.id === 'string' &&
    typeof value.pubkey === 'string' &&
    typeof value.kind === 'number' &&
    typeof value.created_at === 'number' &&
    typeof value.content === 'string' &&
    typeof value.sig === 'string' &&
    Array.isArray(value.tags) &&
    value.tags.every(isStringArray)
  )
}

function parseFilter(value: unknown): Filter | null {
  if (!isRecord(value)) {
    return null
  }
  const { ids, authors, kinds, since, until, limit } = value
  if (!isOptionalStringArray(ids) || !isOptionalStringArray(authors)) {
    return null
  }
  if (!isOptionalNumberArray(kinds)) {
    return null
  }
  if (
    !isOptionalNumber(since) ||
    !isOptionalNumber(until) ||
    !isOptionalNumber(limit)
  ) {
    return null
  }
  const filter: Filter = {
    ...(ids ? { ids } : {}),
    ...(authors ? { authors } : {}),
    ...(kinds ? { kinds } : {}),
    ...(since === undefined ? {} : { since }),
    ...(until === undefined ? {} : { until }),
    ...(limit === undefined ? {} : { limit })
  }
  for (const [key, field] of Object.entries(value)) {
    if (!isTagKey(key)) {
      continue
    }
    if (!isStringArray(field)) {
      return null
    }
    filter[key] = field
  }
  return filter
}

function parseFrame(raw: unknown): unknown {
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

function matchesTags(filter: Filter, event: Event) {
  return Object.entries(filter).every(([key, values]) => {
    if (!isTagKey(key) || !isStringArray(values)) {
      return true
    }
    const tagName = key.slice(1)
    return event.tags.some(
      ([name, value]) => name === tagName && values.includes(value)
    )
  })
}

function matchesFilter(filter: Filter, event: Event) {
  if (filter.ids && !filter.ids.includes(event.id)) {
    return false
  }
  if (filter.authors && !filter.authors.includes(event.pubkey)) {
    return false
  }
  if (filter.kinds && !filter.kinds.includes(event.kind)) {
    return false
  }
  if (filter.since !== undefined && event.created_at < filter.since) {
    return false
  }
  if (filter.until !== undefined && event.created_at > filter.until) {
    return false
  }
  return matchesTags(filter, event)
}

function matchesAnyFilter(filters: Filter[], event: Event) {
  return filters.some((filter) => matchesFilter(filter, event))
}

function isReplaceable(kind: number) {
  return (
    kind === METADATA_KIND ||
    kind === CONTACTS_KIND ||
    (kind >= REPLACEABLE_RANGE.min && kind <= REPLACEABLE_RANGE.max)
  )
}

function isAddressable(kind: number) {
  return kind >= ADDRESSABLE_RANGE.min && kind <= ADDRESSABLE_RANGE.max
}

function dTag(event: Event) {
  return event.tags.find(([name]) => name === 'd')?.[1] ?? ''
}

function replacementKey(event: Event) {
  if (isReplaceable(event.kind)) {
    return `${event.kind}:${event.pubkey}`
  }
  if (isAddressable(event.kind)) {
    return `${event.kind}:${event.pubkey}:${dTag(event)}`
  }
  return null
}

function isNewer(candidate: Event, existing: Event) {
  if (candidate.created_at !== existing.created_at) {
    return candidate.created_at > existing.created_at
  }
  return candidate.id < existing.id
}

function newestFirst(a: Event, b: Event) {
  if (a.created_at !== b.created_at) {
    return b.created_at - a.created_at
  }
  return a.id.localeCompare(b.id)
}

function createEventStore(verifySignatures: boolean) {
  const stored = new Map<string, Event>()
  const deletedByAuthor = new Map<string, Set<string>>()

  function applyDeletion(deletion: Event) {
    for (const [name, id] of deletion.tags) {
      if (name !== 'e') {
        continue
      }
      const authors = deletedByAuthor.get(id) ?? new Set<string>()
      authors.add(deletion.pubkey)
      deletedByAuthor.set(id, authors)
      const target = stored.get(id)
      if (target?.pubkey === deletion.pubkey) {
        stored.delete(id)
      }
    }
  }

  function findReplaced(event: Event) {
    const key = replacementKey(event)
    if (!key) {
      return null
    }
    return [...stored.values()].find((other) => replacementKey(other) === key)
  }

  function store(event: Event): StoreResult {
    if (verifySignatures && !verifyEvent(event)) {
      return { accepted: false, message: 'invalid: bad signature' }
    }
    if (stored.has(event.id)) {
      return { accepted: false, message: 'duplicate: already have this event' }
    }
    if (deletedByAuthor.get(event.id)?.has(event.pubkey)) {
      return { accepted: false, message: 'blocked: event was deleted' }
    }
    const replaced = findReplaced(event)
    if (replaced && !isNewer(event, replaced)) {
      return { accepted: false, message: 'duplicate: have a newer version' }
    }
    if (replaced) {
      stored.delete(replaced.id)
    }
    stored.set(event.id, event)
    if (event.kind === DELETION_KIND) {
      applyDeletion(event)
    }
    return { accepted: true }
  }

  function query(filters: Filter[]) {
    const selected = new Map<string, Event>()
    for (const filter of filters) {
      const matching = all().filter((event) =>
        matchesAnyFilter([filter], event)
      )
      const limited =
        filter.limit === undefined ? matching : matching.slice(0, filter.limit)
      for (const event of limited) {
        selected.set(event.id, event)
      }
    }
    return [...selected.values()].toSorted(newestFirst)
  }

  function all() {
    return [...stored.values()].toSorted(newestFirst)
  }

  return { all, query, store }
}

async function startTestRelay(
  options: TestRelayOptions = {}
): Promise<TestRelay> {
  const eventStore = createEventStore(options.verifySignatures ?? false)
  const connections = new Map<WebSocket, Connection>()
  const requests: ReqLogEntry[] = []
  const pendingTimers = new Set<NodeJS.Timeout>()
  const state: { fault: RelayFault | null; nextConnectionId: number } = {
    fault: null,
    nextConnectionId: 1
  }

  const server = new WebSocketServer({
    host: RELAY_HOST,
    port: RANDOM_PORT,
    verifyClient: (_info, done) => {
      if (state.fault?.type === 'refuse') {
        done(false, REFUSED_STATUS_CODE)
        return
      }
      done(true)
    }
  })

  function send(connection: Connection, message: unknown[]) {
    if (connection.socket.readyState !== connection.socket.OPEN) {
      return
    }
    connection.socket.send(JSON.stringify(message))
  }

  function sendEvent(connection: Connection, subId: string, event: Event) {
    const { fault } = state
    if (fault?.type === 'dropAfter' && connection.sentEvents >= fault.events) {
      connection.socket.terminate()
      return false
    }
    send(connection, ['EVENT', subId, event])
    connection.sentEvents += 1
    return true
  }

  function sendEose(connection: Connection, subId: string) {
    const { fault } = state
    if (fault?.type === 'neverEose') {
      return
    }
    if (fault?.type !== 'delayEose') {
      send(connection, ['EOSE', subId])
      return
    }
    const timer = setTimeout(() => {
      pendingTimers.delete(timer)
      send(connection, ['EOSE', subId])
    }, fault.ms)
    pendingTimers.add(timer)
  }

  function broadcast(event: Event) {
    for (const connection of connections.values()) {
      for (const [subId, filters] of connection.subscriptions) {
        if (matchesAnyFilter(filters, event)) {
          sendEvent(connection, subId, event)
        }
      }
    }
  }

  function handleEvent(connection: Connection, payload: unknown) {
    if (!isNostrEvent(payload)) {
      send(connection, ['NOTICE', 'invalid: malformed event'])
      return
    }
    const { fault } = state
    if (fault?.type === 'rejectPublish') {
      send(connection, ['OK', payload.id, false, fault.reason])
      return
    }
    const result = eventStore.store(payload)
    if (!result.accepted) {
      const isDuplicate = result.message.startsWith('duplicate')
      send(connection, ['OK', payload.id, isDuplicate, result.message])
      return
    }
    send(connection, ['OK', payload.id, true, ''])
    broadcast(payload)
  }

  function handleReq(
    connection: Connection,
    subId: unknown,
    rawFilters: unknown[]
  ) {
    if (typeof subId !== 'string') {
      send(connection, ['NOTICE', 'invalid: subscription id'])
      return
    }
    const filters = rawFilters.map(parseFilter)
    const validFilters = filters.filter((filter) => filter !== null)
    if (validFilters.length !== filters.length) {
      send(connection, ['CLOSED', subId, 'invalid: malformed filter'])
      return
    }
    requests.push({
      at: Date.now(),
      connectionId: connection.id,
      filters: validFilters,
      subId
    })
    const { fault } = state
    if (fault?.type === 'closed') {
      send(connection, ['CLOSED', subId, fault.reason])
      return
    }
    connection.subscriptions.set(subId, validFilters)
    const delivered = eventStore
      .query(validFilters)
      .every((event) => sendEvent(connection, subId, event))
    if (!delivered) {
      return
    }
    if (fault?.type === 'dropAfter' && connection.sentEvents >= fault.events) {
      connection.socket.terminate()
      return
    }
    sendEose(connection, subId)
  }

  function handleMessage(connection: Connection, raw: unknown) {
    const frame = parseFrame(raw)
    if (!Array.isArray(frame)) {
      send(connection, ['NOTICE', 'invalid: frame is not an array'])
      return
    }
    const [verb, first, ...rest] = frame
    if (verb === 'EVENT') {
      handleEvent(connection, first)
      return
    }
    if (verb === 'REQ') {
      handleReq(connection, first, rest)
      return
    }
    if (verb === 'CLOSE' && typeof first === 'string') {
      connection.subscriptions.delete(first)
      return
    }
    send(connection, ['NOTICE', `unsupported: ${String(verb)}`])
  }

  server.on('connection', (socket) => {
    const connection: Connection = {
      id: state.nextConnectionId,
      sentEvents: 0,
      socket,
      subscriptions: new Map()
    }
    state.nextConnectionId += 1
    connections.set(socket, connection)
    socket.on('message', (raw) => handleMessage(connection, raw))
    socket.on('close', () => connections.delete(socket))
  })

  await once(server, 'listening')
  const address = server.address()
  if (typeof address === 'string' || address === null) {
    throw new Error('test relay did not bind to a TCP port')
  }

  function disconnectAll() {
    for (const socket of connections.keys()) {
      socket.terminate()
    }
    connections.clear()
  }

  async function stop() {
    for (const timer of pendingTimers) {
      clearTimeout(timer)
    }
    pendingTimers.clear()
    disconnectAll()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  return {
    connectionCount: () => connections.size,
    disconnectAll,
    events: () => eventStore.all(),
    inject: (event) => {
      if (eventStore.store(event).accepted) {
        broadcast(event)
      }
    },
    openSubscriptions: () =>
      [...connections.values()].map((connection) => ({
        connectionId: connection.id,
        subIds: [...connection.subscriptions.keys()]
      })),
    reqLog: () => [...requests],
    seed: (events) => {
      for (const event of events) {
        eventStore.store(event)
      }
    },
    setFault: (fault) => {
      state.fault = fault
    },
    stop,
    url: `ws://${RELAY_HOST}:${address.port}`
  }
}

export { startTestRelay }
export type {
  OpenSubscriptions,
  RelayFault,
  ReqLogEntry,
  TestRelay,
  TestRelayOptions
}
