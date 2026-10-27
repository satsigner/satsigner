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

import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'

const RELAY_URLS = (process.env.RELAY_URLS ?? 'wss://relay.zapstore.dev').split(',')
const nsec = process.env.SIGN_WITH ?? ''

if (!nsec.startsWith('nsec1')) {
  console.error('Error: SIGN_WITH must be an nsec1... key')
  process.exit(1)
}

const decoded = nip19.decode(nsec)
const secretKey = decoded.data
const pubkey = getPublicKey(secretKey)

const [,, command, ...cliArgs] = process.argv

const pool = new SimplePool()

async function fetchOurEvents(kinds = [32267, 30063, 3063]) {
  const events = await pool.querySync(RELAY_URLS, {
    authors: [pubkey],
    kinds
  }, { maxWait: 8000 })
  return events
}

async function publishEvent(template) {
  const event = finalizeEvent(template, secretKey)
  console.log(`Publishing kind:${event.kind} id:${event.id}`)
  const results = await Promise.allSettled(pool.publish(RELAY_URLS, event))
  for (const [i, r] of results.entries()) {
    console.log(`  ${r.status === 'fulfilled' ? 'ok ' : 'err'} ${RELAY_URLS[i]}`)
  }
  return event
}

if (command === 'list') {
  // ── LIST ──────────────────────────────────────────────────────────────────
  const events = await fetchOurEvents()
  if (events.length === 0) {
    console.log('No events found on relay for this pubkey.')
  } else {
    console.log(`Found ${events.length} events for pubkey ${pubkey}:\n`)
    for (const e of events.sort((a, b) => b.created_at - a.created_at)) {
      const d = e.tags.find(t => t[0] === 'd')?.[1]
            ?? e.tags.find(t => t[0] === 'i')?.[1]
            ?? '—'
      const version = e.tags.find(t => t[0] === 'version')?.[1] ?? ''
      const channel = e.tags.find(t => t[0] === 'c')?.[1] ?? ''
      console.log(`kind:${e.kind}  id:${e.id}`)
      console.log(`  package: ${d}  version:${version}  channel:${channel}`)
      console.log(`  created: ${new Date(e.created_at * 1000).toISOString()}\n`)
    }
  }

} else if (command === 'delete') {
  // ── DELETE specific event IDs ──────────────────────────────────────────────
  if (cliArgs.length === 0) {
    console.error('Usage: zapstore-manage.mjs delete <eventId> [eventId...]')
    process.exit(1)
  }
  console.log(`Sending NIP-09 deletion for ${cliArgs.length} event(s)...`)
  await publishEvent({
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: cliArgs.map(id => ['e', id]),
    content: 'Deleted by publisher'
  })
  console.log('\nDeletion event published. Note: relay support for NIP-09 varies.')

} else if (command === 'delete-app') {
  // ── DELETE all events for a package ID ────────────────────────────────────
  const packageId = cliArgs[0]
  if (!packageId) {
    console.error('Usage: zapstore-manage.mjs delete-app <packageId>')
    process.exit(1)
  }
  const events = await fetchOurEvents()
  const matching = events.filter(e =>
    e.tags.some(t => (t[0] === 'd' || t[0] === 'i') && t[1] === packageId)
  )
  if (matching.length === 0) {
    console.log(`No events found for package: ${packageId}`)
  } else {
    console.log(`Found ${matching.length} events for ${packageId}:`)
    for (const e of matching) console.log(`  kind:${e.kind} id:${e.id}`)
    console.log('\nSending NIP-09 deletion...')
    await publishEvent({
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags: matching.map(e => ['e', e.id]),
      content: `Deleting all events for ${packageId}`
    })
    console.log('\nDeletion event published.')
  }

} else {
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

pool.close(RELAY_URLS)
