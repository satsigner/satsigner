import {
  NOSTR_PENDING_DM_ID_PREFIX,
  NOSTR_PENDING_MATCH_CREATED_AT_TOLERANCE_SEC
} from '@/constants/nostr'
import { type NostrDM } from '@/types/models/Nostr'

function sortDmsByCreatedAt(dms: NostrDM[]): NostrDM[] {
  return dms.toSorted((a, b) => a.created_at - b.created_at)
}

function isOptimisticDmId(id: string): boolean {
  return id.startsWith(NOSTR_PENDING_DM_ID_PREFIX)
}

function createOptimisticDmId(now = Date.now()): string {
  return `${NOSTR_PENDING_DM_ID_PREFIX}${now}`
}

function samePubkey(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Finds the optimistic copy of a message this device sent, so the relay echo
 * replaces it instead of showing the message twice.
 */
function findOptimisticEcho(
  dms: NostrDM[],
  echo: NostrDM,
  devicePubkeyHex: string
): NostrDM | undefined {
  return dms.find(
    (dm) =>
      isOptimisticDmId(dm.id) &&
      samePubkey(dm.author, devicePubkeyHex) &&
      dm.description === echo.description &&
      Math.abs(dm.created_at - echo.created_at) <=
        NOSTR_PENDING_MATCH_CREATED_AT_TOLERANCE_SEC
  )
}

export {
  createOptimisticDmId,
  findOptimisticEcho,
  isOptimisticDmId,
  samePubkey,
  sortDmsByCreatedAt
}
