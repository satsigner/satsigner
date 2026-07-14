import type {
  ArkDerivedAddress,
  ArkMovement,
  ArkMovementStatus
} from '@/types/models/Ark'
import {
  buildArkReceiveInfo,
  clearArkDerivedAddresses,
  countUsedArkAddresses,
  scanArkAddresses,
  withArkDerivedAddressCache
} from '@/utils/arkAddress'

function buildMovement(overrides: Partial<ArkMovement> = {}): ArkMovement {
  return {
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    effectiveBalanceSats: 0,
    exitedVtxoIds: [],
    id: 1,
    inputVtxoIds: [],
    intendedBalanceSats: 0,
    metadataJson: '',
    offchainFeeSats: 0,
    outputVtxoIds: [],
    receivedOnAddresses: [],
    sentToAddresses: [],
    status: 'successful' satisfies ArkMovementStatus,
    subsystemKind: 'arkoor',
    subsystemName: 'bark.send',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function makeDerive(revealedCount: number) {
  return (startIndex: number, count: number): Promise<ArkDerivedAddress[]> => {
    const length = Math.max(0, Math.min(count, revealedCount - startIndex))
    return Promise.resolve(
      Array.from({ length }, (_, offset) => ({
        address: `addr${startIndex + offset}`,
        index: startIndex + offset
      }))
    )
  }
}

const fakeDerive = makeDerive(Number.MAX_SAFE_INTEGER)

describe('buildArkReceiveInfo', () => {
  it('accumulates received sats and count per address from receive movements', () => {
    const movements = [
      buildMovement({
        effectiveBalanceSats: 1000,
        receivedOnAddresses: ['addr2']
      }),
      buildMovement({
        effectiveBalanceSats: 500,
        receivedOnAddresses: ['addr2']
      })
    ]
    const info = buildArkReceiveInfo(movements)
    expect(info.get('addr2')).toStrictEqual({
      receiveCount: 2,
      receivedSats: 1500
    })
  })

  it('ignores send movements', () => {
    const movements = [
      buildMovement({
        effectiveBalanceSats: -1000,
        sentToAddresses: ['addr1']
      })
    ]
    expect(buildArkReceiveInfo(movements).size).toBe(0)
  })
})

describe('scanArkAddresses', () => {
  it('returns every revealed address with its usage info', async () => {
    const info = buildArkReceiveInfo([
      buildMovement({
        effectiveBalanceSats: 1000,
        receivedOnAddresses: ['addr2']
      })
    ])
    const result = await scanArkAddresses(makeDerive(8), info, 3, 100)
    expect(result.map((address) => address.index)).toStrictEqual([
      0, 1, 2, 3, 4, 5, 6, 7
    ])
    expect(result.find((a) => a.index === 2)).toMatchObject({
      receiveCount: 1,
      receivedSats: 1000,
      used: true
    })
    expect(result.filter((a) => a.index !== 2).every((a) => !a.used)).toBe(true)
  })

  it('includes revealed addresses far beyond the last used one', async () => {
    const info = buildArkReceiveInfo([
      buildMovement({
        effectiveBalanceSats: 1000,
        receivedOnAddresses: ['addr0']
      })
    ])
    const result = await scanArkAddresses(makeDerive(30), info, 5, 100)
    expect(result).toHaveLength(30)
    expect(result.at(-1)).toMatchObject({ index: 29, used: false })
  })

  it('returns an empty list when no address was revealed', async () => {
    const result = await scanArkAddresses(makeDerive(0), new Map(), 3, 100)
    expect(result).toStrictEqual([])
  })

  it('handles a revealed count that is an exact multiple of the batch size', async () => {
    const result = await scanArkAddresses(makeDerive(6), new Map(), 3, 100)
    expect(result.map((address) => address.index)).toStrictEqual([
      0, 1, 2, 3, 4, 5
    ])
  })

  it('stops at maxScan as a safety bound', async () => {
    const result = await scanArkAddresses(fakeDerive, new Map(), 3, 4)
    expect(result.map((address) => address.index)).toStrictEqual([0, 1, 2, 3])
  })
})

describe('countUsedArkAddresses', () => {
  it('counts only addresses marked as used', async () => {
    const info = buildArkReceiveInfo([
      buildMovement({
        effectiveBalanceSats: 1000,
        receivedOnAddresses: ['addr2']
      })
    ])
    const addresses = await scanArkAddresses(fakeDerive, info, 3, 100)
    expect(addresses.length).toBeGreaterThan(1)
    expect(countUsedArkAddresses(addresses)).toBe(1)
  })

  it('returns zero when no address is used', async () => {
    const addresses = await scanArkAddresses(fakeDerive, new Map(), 3, 100)
    expect(countUsedArkAddresses(addresses)).toBe(0)
  })
})

describe('withArkDerivedAddressCache', () => {
  afterEach(() => {
    clearArkDerivedAddresses('acc1')
    clearArkDerivedAddresses('acc2')
  })

  it('serves fully cached batches without calling derive again', async () => {
    const derive = jest.fn(fakeDerive)
    const cachedDerive = withArkDerivedAddressCache('acc1', derive)
    const first = await cachedDerive(0, 3)
    const second = await cachedDerive(0, 3)
    expect(derive).toHaveBeenCalledTimes(1)
    expect(second).toStrictEqual(first)
  })

  it('calls derive when part of the batch is not cached', async () => {
    const derive = jest.fn(fakeDerive)
    const cachedDerive = withArkDerivedAddressCache('acc1', derive)
    await cachedDerive(0, 3)
    await cachedDerive(3, 3)
    expect(derive).toHaveBeenCalledTimes(2)
    expect(derive).toHaveBeenLastCalledWith(3, 3)
  })

  it('keeps caches isolated per account and clears on demand', async () => {
    const derive = jest.fn(fakeDerive)
    const cachedA = withArkDerivedAddressCache('acc1', derive)
    const cachedB = withArkDerivedAddressCache('acc2', derive)
    await cachedA(0, 2)
    await cachedB(0, 2)
    expect(derive).toHaveBeenCalledTimes(2)
    clearArkDerivedAddresses('acc1')
    await cachedA(0, 2)
    expect(derive).toHaveBeenCalledTimes(3)
  })
})
