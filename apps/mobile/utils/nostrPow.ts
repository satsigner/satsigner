import { generateContentTags } from '@nostr-dev-kit/ndk'
import { getPublicKey } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { getEventHash } from 'nostr-tools/pure'

import {
  NOSTR_POW_HASHES_PER_YIELD,
  NOSTR_POW_MAX_DIFFICULTY,
  NOSTR_POW_MIN_DIFFICULTY,
  NOSTR_POW_NONCE_TAG
} from '@/constants/nostr'
import { getSecretFromNsec } from '@/utils/nostr'

type MineNostrPowInput = {
  content: string
  createdAt: number
  difficulty: number
  kind: number
  onProgress?: (nonce: number) => void
  pubkey: string
  tags: string[][]
}

type ApplyNostrProofOfWorkInput = {
  content: string
  difficulty: number | null
  kind?: number
  nsec: string
  onProgress?: (nonce: number) => void
  tags: string[][]
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

    createdAt = Math.floor(Date.now() / 1000)
    input.onProgress?.(nonce)
    await yieldToUi()
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
    tags: tagged.tags
  })

  return {
    content: tagged.content,
    createdAt: mined.createdAt,
    tags: mined.tags
  }
}
