import { generateContentTags } from '@nostr-dev-kit/ndk'
import { getPublicKey } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { getEventHash } from 'nostr-tools/pure'

import {
  NOSTR_CHAT_POW_MAX_MS,
  NOSTR_POW_HASHES_PER_YIELD,
  NOSTR_POW_MAX_DIFFICULTY,
  NOSTR_HEX_PUBKEY_RE,
  NOSTR_POW_MIN_DIFFICULTY,
  NOSTR_POW_NONCE_TAG
} from '@/constants/nostr'
import { getSecretFromNsec } from '@/utils/nostr'

type MineNostrPowInput = {
  content: string
  createdAt: number
  difficulty: number
  /** Keep createdAt while mining (gift wraps are deliberately backdated). */
  fixedCreatedAt?: boolean
  kind: number
  onProgress?: (nonce: number) => void
  pubkey: string
  signal?: AbortSignal
  tags: string[][]
}

type ApplyNostrProofOfWorkInput = {
  content: string
  difficulty: number | null
  kind?: number
  nsec: string
  onProgress?: (nonce: number) => void
  signal?: AbortSignal
  tags: string[][]
}

/** Mining stopped because the note it was for was abandoned. */
export class NostrPowAbortedError extends Error {
  override name = 'NostrPowAbortedError'
}

export const POW_LEVELS = Array.from(
  {
    length: NOSTR_POW_MAX_DIFFICULTY - NOSTR_POW_MIN_DIFFICULTY + 1
  },
  (_, index) => NOSTR_POW_MIN_DIFFICULTY + index
)

const HASH_GROUP_PATTERN = /\B(?=(\d{3})+(?!\d))/g

export function expectedPowHashes(difficulty: number): string {
  return (2 ** difficulty).toString().replace(HASH_GROUP_PATTERN, ',')
}

export function countLeadingZeroBits(hexId: string): number {
  let count = 0

  for (const char of hexId) {
    const nibble = Number.parseInt(char, 16)
    if (Number.isNaN(nibble)) {
      return count
    }
    if (nibble === 0) {
      count += 4
      continue
    }
    count += Math.clz32(nibble) - 28
    break
  }

  return count
}

export function stripNonceTags(tags: string[][]): string[][] {
  return tags.filter((tag) => tag[0] !== NOSTR_POW_NONCE_TAG)
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export async function mineNostrPow(
  input: MineNostrPowInput
): Promise<{ createdAt: number; tags: string[][] }> {
  const baseTags = stripNonceTags(input.tags)
  const target = String(input.difficulty)
  let { createdAt } = input
  let nonce = 0

  for (;;) {
    const tags = [...baseTags, [NOSTR_POW_NONCE_TAG, String(nonce), target]]
    const id = getEventHash({
      content: input.content,
      created_at: createdAt,
      kind: input.kind,
      pubkey: input.pubkey,
      tags
    })

    if (countLeadingZeroBits(id) >= input.difficulty) {
      return { createdAt, tags }
    }

    nonce += 1
    if (nonce % NOSTR_POW_HASHES_PER_YIELD !== 0) {
      continue
    }

    if (!input.fixedCreatedAt) {
      createdAt = Math.floor(Date.now() / 1000)
    }
    input.onProgress?.(nonce)
    await yieldToUi()
    if (input.signal?.aborted) {
      throw new NostrPowAbortedError('Proof of work was cancelled')
    }
  }
}

export async function applyNostrProofOfWork(
  input: ApplyNostrProofOfWorkInput
): Promise<{ content: string; createdAt?: number; tags: string[][] }> {
  if (input.difficulty === null) {
    return { content: input.content, tags: input.tags }
  }

  const secretKey = getSecretFromNsec(input.nsec)
  if (!secretKey) {
    throw new Error('Invalid nsec')
  }

  // NDK rewrites mentions and adds p/q/t tags while signing. Mining the
  // already-tagged event keeps the signed id equal to the mined id.
  const tagged = await generateContentTags(input.content, [...input.tags])
  const mined = await mineNostrPow({
    content: tagged.content,
    createdAt: Math.floor(Date.now() / 1000),
    difficulty: input.difficulty,
    kind: input.kind ?? nostrKinds.ShortTextNote,
    onProgress: input.onProgress,
    pubkey: getPublicKey(secretKey),
    signal: input.signal,
    tags: tagged.tags
  })

  return {
    content: tagged.content,
    createdAt: mined.createdAt,
    tags: mined.tags
  }
}

function getCommittedTarget(tags: unknown): number {
  if (!Array.isArray(tags)) {
    return 0
  }
  const nonceTag = tags.find(
    (tag) => Array.isArray(tag) && tag[0] === NOSTR_POW_NONCE_TAG
  )
  const target = Array.isArray(nonceTag) ? Number(nonceTag[2]) : 0
  return Number.isInteger(target) && target > 0 ? target : 0
}

/**
 * NIP-13 difficulty an event can be credited with: its leading zero bits,
 * capped by the target committed in its nonce tag, so an id that is lucky
 * without a commitment counts as no work.
 */
export function getCommittedPow(event: { id: string; tags: unknown }): number {
  if (!NOSTR_HEX_PUBKEY_RE.test(event.id)) {
    return 0
  }
  return Math.min(
    countLeadingZeroBits(event.id),
    getCommittedTarget(event.tags)
  )
}

type PowEventTemplate = {
  content: string
  created_at: number
  kind: number
  pubkey: string
  tags: string[][]
}

/**
 * Mines within NOSTR_CHAT_POW_MAX_MS. On timeout the event goes out without
 * proof of work rather than leaving the message stuck.
 */
export async function mineEventWithinDeadline<T extends PowEventTemplate>(
  event: T,
  difficulty: number,
  { fixedCreatedAt = false }: { fixedCreatedAt?: boolean } = {}
): Promise<T> {
  if (difficulty <= 0) {
    return event
  }
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, NOSTR_CHAT_POW_MAX_MS)
  try {
    const mined = await mineNostrPow({
      content: event.content,
      createdAt: event.created_at,
      difficulty: Math.min(difficulty, NOSTR_POW_MAX_DIFFICULTY),
      fixedCreatedAt,
      kind: event.kind,
      pubkey: event.pubkey,
      signal: controller.signal,
      tags: event.tags
    })
    return { ...event, created_at: mined.createdAt, tags: mined.tags }
  } catch (error) {
    if (error instanceof NostrPowAbortedError) {
      return event
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
