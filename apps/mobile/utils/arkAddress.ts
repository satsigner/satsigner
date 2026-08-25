import type {
  ArkAddress,
  ArkDerivedAddress,
  ArkMovement
} from '@/types/models/Ark'

import {
  getArkMovementAmountSats,
  getArkMovementKind,
  parseArkCounterparty
} from './arkMovement'

type ReceiveInfo = {
  receivedSats: number
  receiveCount: number
}

type DeriveAddresses = (
  startIndex: number,
  count: number
) => Promise<ArkDerivedAddress[]>

// Derived addresses are deterministic per wallet, so cache them to avoid
// re-deriving the whole gap-limit range on every rescan.
const derivedAddressCache = new Map<string, Map<number, string>>()

function getOrCreateDerivedCache(accountId: string): Map<number, string> {
  const existing = derivedAddressCache.get(accountId)
  if (existing) {
    return existing
  }
  const created = new Map<number, string>()
  derivedAddressCache.set(accountId, created)
  return created
}

export function clearArkDerivedAddresses(accountId: string): void {
  derivedAddressCache.delete(accountId)
}

export function withArkDerivedAddressCache(
  accountId: string,
  derive: DeriveAddresses
): DeriveAddresses {
  return async (startIndex, count) => {
    const cache = getOrCreateDerivedCache(accountId)
    const cached: ArkDerivedAddress[] = []
    for (const offset of Array.from({ length: count }, (_, i) => i)) {
      const address = cache.get(startIndex + offset)
      if (address === undefined) {
        break
      }
      cached.push({ address, index: startIndex + offset })
    }
    if (cached.length === count) {
      return cached
    }
    const batch = await derive(startIndex, count)
    for (const entry of batch) {
      cache.set(entry.index, entry.address)
    }
    return batch
  }
}

export function buildArkReceiveInfo(
  movements: ArkMovement[]
): Map<string, ReceiveInfo> {
  const infoByAddress = new Map<string, ReceiveInfo>()

  for (const movement of movements) {
    if (getArkMovementKind(movement) !== 'receive') {
      continue
    }
    const amount = getArkMovementAmountSats(movement)
    for (const raw of movement.receivedOnAddresses) {
      const address = parseArkCounterparty(raw)
      const current = infoByAddress.get(address)
      infoByAddress.set(address, {
        receiveCount: (current?.receiveCount ?? 0) + 1,
        receivedSats: (current?.receivedSats ?? 0) + amount
      })
    }
  }

  return infoByAddress
}

function toArkAddress(
  entry: ArkDerivedAddress,
  receiveInfo: Map<string, ReceiveInfo>
): ArkAddress {
  const info = receiveInfo.get(entry.address)
  return {
    address: entry.address,
    index: entry.index,
    receiveCount: info?.receiveCount ?? 0,
    receivedSats: info?.receivedSats ?? 0,
    used: info !== undefined
  }
}

export function countUsedArkAddresses(addresses: ArkAddress[]): number {
  return addresses.filter((address) => address.used).length
}

export async function scanArkAddresses(
  derive: DeriveAddresses,
  receiveInfo: Map<string, ReceiveInfo>,
  batchSize: number,
  maxScan: number
): Promise<ArkAddress[]> {
  const addresses: ArkAddress[] = []
  let index = 0

  while (index < maxScan) {
    const count = Math.min(batchSize, maxScan - index)
    const batch = await derive(index, count)
    for (const entry of batch) {
      addresses.push(toArkAddress(entry, receiveInfo))
    }
    if (batch.length < count) {
      break
    }
    index += batch.length
  }

  return addresses
}
