import type { Event } from 'nostr-tools'

const HEX_ID_LENGTH = 64
const HEX_SIG_LENGTH = 128
const BASE_CREATED_AT = 1_700_000_000
const TEXT_NOTE_KIND = 1

const fixtureCounter = { next: 1 }

function fixtureHex(seed: number, length: number) {
  return seed.toString(16).padStart(length, '0')
}

function fixturePubkey(seed: number) {
  return fixtureHex(seed, HEX_ID_LENGTH)
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  const seed = fixtureCounter.next
  fixtureCounter.next += 1
  return {
    content: `fixture ${seed}`,
    created_at: BASE_CREATED_AT + seed,
    id: fixtureHex(seed, HEX_ID_LENGTH),
    kind: TEXT_NOTE_KIND,
    pubkey: fixturePubkey(1),
    sig: fixtureHex(0, HEX_SIG_LENGTH),
    tags: [],
    ...overrides
  }
}

export { BASE_CREATED_AT, fixturePubkey, makeEvent }
