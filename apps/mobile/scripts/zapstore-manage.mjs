#!/usr/bin/env node
/**
 * zapstore-manage.mjs — Delete or replace Zapstore app/release events
 *
 * Zapstore uses Nostr events — there is no `zsp delete` command.
 * Deletion = publish a NIP-09 kind:5 event referencing the event IDs to remove.
 * Replacement = re-publish with --overwrite-release (for releases) or a new kind:32267
 *               with the same `d` tag (for app metadata — addressable event, self-replaces).
 *
 * Usage:
 *   # Delete specific event IDs (kind:5 deletion request)
 *   node zapstore-manage.mjs delete <eventId> [eventId...]
 *
 *   # Delete all events published by the signing key for a package ID
 *   node zapstore-manage.mjs delete-app <packageId>
 *
 *   # List all events published by the signing key
 *   node zapstore-manage.mjs list
 *
 * Env vars:
 *   SIGN_WITH   nsec1... of the key that originally published
 *   RELAY_URLS  comma-separated relays (default: wss://relay.zapstore.dev)
 */

import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import { Relay } from 'nostr-tools/relay'

const RELAY_URLS = (process.env.RELAY_URLS ?? 'wss://relay.zapstore.dev').split(
  ','
)
const QUERY_TIMEOUT_MS = 8000
const DELETION_KIND = 5
const APP_KIND = 32_267
const RELEASE_KIND = 30_063
const FILE_KIND = 3063
const ADDRESSABLE_KINDS = new Set([APP_KIND, RELEASE_KIND])
const CONNECTION_FAILURE_PREFIX = 'connection failure'

const nsec = process.env.SIGN_WITH ?? ''

if (!nsec.startsWith('nsec1')) {
  console.error('Error: SIGN_WITH must be an nsec1... key')
  process.exit(1)
}

const decoded = nip19.decode(nsec)
const secretKey = decoded.data
const pubkey = getPublicKey(secretKey)

const [, , command, ...cliArgs] = process.argv

const pool = new SimplePool()

// SimplePool.querySync treats an EOSE timeout or a failed connection like a
// finished query, so each relay is queried on its own and only counts as
// complete when it actually sends EOSE.
async function queryRelay(url, filter) {
  const relay = await Relay.connect(url)
  return new Promise((resolve, reject) => {
    const events = []
    const state = { settled: false }

    function settle(error) {
      if (state.settled) {
        return
      }
      state.settled = true
      clearTimeout(timer)
      relay.close()
      if (error) {
        reject(error)
        return
      }
      resolve(events)
    }

    const timer = setTimeout(
      () => settle(new Error(`no EOSE within ${QUERY_TIMEOUT_MS}ms`)),
      QUERY_TIMEOUT_MS
    )
    relay.subscribe([filter], {
      eoseTimeout: QUERY_TIMEOUT_MS * 2,
      onclose: (reason) => settle(new Error(`closed: ${reason}`)),
      oneose: () => settle(),
      onevent: (event) => events.push(event)
    })
  })
}

async function fetchOurEvents(kinds = [APP_KIND, RELEASE_KIND, FILE_KIND]) {
  const filter = { authors: [pubkey], kinds }
  const results = await Promise.allSettled(
    RELAY_URLS.map((url) => queryRelay(url, filter))
  )
  const byId = new Map()
  const failures = []
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      failures.push(
        `${RELAY_URLS[index]}: ${result.reason?.message ?? result.reason}`
      )
      continue
    }
    for (const event of result.value) {
      byId.set(event.id, event)
    }
  }
  return { events: [...byId.values()], failures }
}

function reportFailures(failures) {
  for (const failure of failures) {
    console.error(`  incomplete ${failure}`)
  }
}

function isAccepted(result) {
  return (
    result.status === 'fulfilled' &&
    !String(result.value).startsWith(CONNECTION_FAILURE_PREFIX)
  )
}

async function publishEvent(template) {
  const event = finalizeEvent(template, secretKey)
  console.log(`Publishing kind:${event.kind} id:${event.id}`)
  const results = await Promise.allSettled(pool.publish(RELAY_URLS, event))
  for (const [index, result] of results.entries()) {
    const detail =
      result.status === 'fulfilled' ? result.value : result.reason?.message
    console.log(
      `  ${isAccepted(result) ? 'ok ' : 'err'} ${RELAY_URLS[index]} ${detail ?? ''}`
    )
  }
  const accepted = results.filter(isAccepted).length
  if (accepted === 0) {
    throw new Error('No relay accepted the event')
  }
  return { accepted, event }
}

function packageTagValue(event) {
  return (
    event.tags.find((tag) => tag[0] === 'd')?.[1] ??
    event.tags.find((tag) => tag[0] === 'i')?.[1]
  )
}

// NIP-09: an `a` tag deletes every version at an addressable coordinate,
// including versions this query did not return.
function deletionTags(events) {
  const eTags = events.map((event) => ['e', event.id])
  const coordinates = new Set(
    events.flatMap((event) => {
      const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1]
      return ADDRESSABLE_KINDS.has(event.kind) && dTag !== undefined
        ? [`${event.kind}:${pubkey}:${dTag}`]
        : []
    })
  )
  const aTags = [...coordinates].map((coordinate) => ['a', coordinate])
  const kTags = [...new Set(events.map((event) => String(event.kind)))].map(
    (kind) => ['k', kind]
  )
  return [...eTags, ...aTags, ...kTags]
}

async function runList() {
  const { events, failures } = await fetchOurEvents()
  if (failures.length === RELAY_URLS.length) {
    reportFailures(failures)
    throw new Error('No relay answered the query')
  }
  if (failures.length > 0) {
    console.error('Results are incomplete:')
    reportFailures(failures)
  }
  if (events.length === 0) {
    console.log('No events found on the relays that answered.')
    return
  }
  console.log(`Found ${events.length} events for pubkey ${pubkey}:\n`)
  for (const event of events.toSorted((a, b) => b.created_at - a.created_at)) {
    const version = event.tags.find((tag) => tag[0] === 'version')?.[1] ?? ''
    const channel = event.tags.find((tag) => tag[0] === 'c')?.[1] ?? ''
    console.log(`kind:${event.kind}  id:${event.id}`)
    console.log(
      `  package: ${packageTagValue(event) ?? '—'}  version:${version}  channel:${channel}`
    )
    console.log(
      `  created: ${new Date(event.created_at * 1000).toISOString()}\n`
    )
  }
}

async function runDelete() {
  if (cliArgs.length === 0) {
    throw new Error('Usage: zapstore-manage.mjs delete <eventId> [eventId...]')
  }
  console.log(`Sending NIP-09 deletion for ${cliArgs.length} event(s)...`)
  const { accepted } = await publishEvent({
    content: 'Deleted by publisher',
    created_at: Math.floor(Date.now() / 1000),
    kind: DELETION_KIND,
    tags: cliArgs.map((id) => ['e', id])
  })
  console.log(
    `\nDeletion event accepted by ${accepted}/${RELAY_URLS.length} relays. Note: relay support for NIP-09 varies.`
  )
}

async function runDeleteApp() {
  const [packageId] = cliArgs
  if (!packageId) {
    throw new Error('Usage: zapstore-manage.mjs delete-app <packageId>')
  }
  const { events, failures } = await fetchOurEvents()
  if (failures.length > 0) {
    reportFailures(failures)
    throw new Error(
      'Not every relay answered, so the event list may be incomplete. Nothing was deleted.'
    )
  }
  const matching = events.filter((event) =>
    event.tags.some(
      (tag) => (tag[0] === 'd' || tag[0] === 'i') && tag[1] === packageId
    )
  )
  if (matching.length === 0) {
    console.log(`No events found for package: ${packageId}`)
    return
  }
  console.log(`Found ${matching.length} events for ${packageId}:`)
  for (const event of matching) {
    console.log(`  kind:${event.kind} id:${event.id}`)
  }
  console.log('\nSending NIP-09 deletion...')
  const { accepted } = await publishEvent({
    content: `Deleting all events for ${packageId}`,
    created_at: Math.floor(Date.now() / 1000),
    kind: DELETION_KIND,
    tags: deletionTags(matching)
  })
  console.log(
    `\nDeletion event accepted by ${accepted}/${RELAY_URLS.length} relays.`
  )
}

function printHelp() {
  console.log(`Commands:
  list                         List all Zapstore events for this key
  delete <id> [id...]          Delete specific event IDs (NIP-09 kind:5)
  delete-app <packageId>       Delete all events for a package

Replace a release:
  zsp publish --overwrite-release [options] <apk>   Re-publish same version
  zsp publish [options] <new_apk>                   Publish new version (supersedes old)

Replace app metadata (kind:32267):
  Just re-run zsp publish — kind:32267 is addressable (same 'd' tag replaces it).`)
}

const COMMANDS = {
  delete: runDelete,
  'delete-app': runDeleteApp,
  list: runList
}

try {
  await (COMMANDS[command] ?? printHelp)()
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
} finally {
  pool.close(RELAY_URLS)
}
