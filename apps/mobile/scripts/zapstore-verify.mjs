import { SimplePool } from 'nostr-tools/pool'

const ZAPSTORE_RELAY = 'wss://relay.zapstore.dev'
const ZAPSTORE_APPS_URL = 'https://zapstore.dev/apps'
const QUERY_MAX_WAIT_MS = 8000
// Zapstore can take several minutes to check the APK and save the events.
const VERIFY_ATTEMPTS = 60
const VERIFY_DELAY_MS = 5000
const HTTP_OK = 200

const KIND_APP = 32267
const KIND_RELEASE = 30063
const KIND_ASSET = 3063

const EVENT_LABELS = new Map([
  [KIND_APP, 'App listing'],
  [KIND_RELEASE, 'Release'],
  [KIND_ASSET, 'APK asset']
])

function parseZspEvents(lines) {
  return lines.flatMap((line) => {
    const text = line.trim()
    if (!text.startsWith('{"')) {
      return []
    }
    try {
      const event = JSON.parse(text)
      return typeof event.id === 'string' && Number.isInteger(event.kind)
        ? [event]
        : []
    } catch {
      return []
    }
  })
}

function tagValue(event, name) {
  return event?.tags.find((tag) => tag[0] === name)?.[1]
}

function apkUrlOf(events) {
  return tagValue(
    events.find((event) => event.kind === KIND_ASSET),
    'url'
  )
}

function storePageOf(events) {
  const identifier = tagValue(
    events.find((event) => event.kind === KIND_APP),
    'd'
  )
  return identifier ? `${ZAPSTORE_APPS_URL}/${identifier}` : null
}

function isLive(events, { apkStatus, savedIds }) {
  return (
    events.every((event) => savedIds.has(event.id)) && apkStatus === HTTP_OK
  )
}

function describeStatus(events, status) {
  const eventLines = events.map((event) => {
    const mark = status.savedIds.has(event.id) ? 'ok     ' : 'missing'
    const label = EVENT_LABELS.get(event.kind) ?? `kind ${event.kind}`
    return `    ${mark} ${label.padEnd(12)} ${event.id}`
  })
  const apkMark = status.apkStatus === HTTP_OK ? 'ok     ' : 'missing'
  const apkResult = status.apkStatus ? `HTTP ${status.apkStatus}` : 'no reply'
  return [
    `  On ${ZAPSTORE_RELAY}:`,
    ...eventLines,
    '  APK download:',
    `    ${apkMark} ${status.apkUrl ?? '(no url in the asset event)'} (${apkResult})`,
    `  Store page: ${storePageOf(events) ?? '(unknown)'}`
  ].join('\n')
}

async function httpStatus(url) {
  if (!url) {
    return null
  }
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.status
  } catch {
    return null
  }
}

async function zapstoreStatus(events) {
  const pool = new SimplePool()
  try {
    const saved = await pool.querySync(
      [ZAPSTORE_RELAY],
      { ids: events.map((event) => event.id) },
      { maxWait: QUERY_MAX_WAIT_MS }
    )
    const apkUrl = apkUrlOf(events)
    return {
      apkStatus: await httpStatus(apkUrl),
      apkUrl,
      savedIds: new Set(saved.map((event) => event.id))
    }
  } finally {
    pool.close([ZAPSTORE_RELAY])
  }
}

async function waitForZapstore(events, attemptsLeft) {
  const status = await zapstoreStatus(events)
  if (isLive(events, status) || attemptsLeft <= 1) {
    return status
  }
  await new Promise((resolve) => setTimeout(resolve, VERIFY_DELAY_MS))
  return waitForZapstore(events, attemptsLeft - 1)
}

// relay.zapstore.dev answers OK to new listings and holds them as "pending"
// until its own checks pass, so zsp reports success either way. The checks
// read the APK in the background and can take several minutes.
const PENDING_MESSAGE =
  'Zapstore accepted the release but has not saved it yet. The relay holds ' +
  'new releases as pending until its checks pass. Check the store page ' +
  'again in a few minutes before publishing again.'

async function verifyOnZapstore(events) {
  console.log(
    '\n  Checking that Zapstore saved the release. This can take a few minutes...'
  )
  const status = await waitForZapstore(events, VERIFY_ATTEMPTS)
  console.log(describeStatus(events, status))
  if (!isLive(events, status)) {
    throw new Error(PENDING_MESSAGE)
  }
  console.log('\n  The release is live on Zapstore.')
}

export {
  describeStatus,
  isLive,
  parseZspEvents,
  verifyOnZapstore
}
