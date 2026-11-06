import type { VtxoData } from 'bitcoin-decoder'

import {
  ARK_VTXO_EXPIRY_WARNING_BLOCKS,
  ARK_VTXO_LINEAGE_EDGE_STEPS
} from '@/constants/ark'
import type { ArkMovement } from '@/types/models/Ark'
import {
  type ArkVtxoLineageStep,
  buildArkVtxoLineage,
  findArkVtxoMovements,
  getArkVtxoEta,
  getArkVtxoExpiry,
  getArkVtxoLineageView,
  getArkVtxoPolicyKey,
  getArkVtxoPolicyPaymentHash,
  getArkVtxoRoute,
  isArkVtxoExitUneconomical
} from '@/utils/arkVtxoDetail'

const BLOCKS_PER_DAY = 144
const LIFETIME_BLOCKS = 4032

function buildMovement(overrides: Partial<ArkMovement> = {}): ArkMovement {
  return {
    completedAt: null,
    createdAt: '2026-11-05T10:00:00Z',
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
    status: 'successful',
    subsystemKind: '',
    subsystemName: '',
    updatedAt: '2026-11-05T10:00:00Z',
    ...overrides
  }
}

const chain: Pick<VtxoData, 'exitChain' | 'genesis'> = {
  exitChain: [
    {
      feeAmount: 0,
      hex: '',
      inputAmount: 100_000,
      isSigned: true,
      outputAmount: 40_000,
      txid: 'root',
      vout: 1
    },
    {
      feeAmount: 0,
      hex: '',
      inputAmount: 40_000,
      isSigned: false,
      outputAmount: 15_000,
      txid: 'leaf',
      vout: 0
    }
  ],
  genesis: [
    {
      feeAmount: 0,
      isSigned: true,
      otherOutputs: [
        { scriptPubKey: 'a', value: 50_000 },
        { scriptPubKey: 'b', value: 10_000 }
      ],
      outputIdx: 1,
      transition: { kind: 'cosigned', pubkeys: [], signature: 'ab' }
    },
    {
      feeAmount: 0,
      isSigned: false,
      otherOutputs: [{ scriptPubKey: 'c', value: 25_000 }],
      outputIdx: 0,
      transition: {
        kind: 'hash-locked-cosigned',
        preimage: null,
        signature: null,
        unlockHash: 'cd',
        userPubkey: '02'
      }
    }
  ]
}

describe('getArkVtxoExpiry', () => {
  it('measures blocks left and the elapsed share of the lifetime', () => {
    expect(
      getArkVtxoExpiry({
        expiryHeight: 5040,
        lifetimeBlocks: LIFETIME_BLOCKS,
        tipHeight: 2016
      })
    ).toStrictEqual({ blocksLeft: 3024, elapsedRatio: 0.25, urgency: 'ok' })
  })

  it('warns once the warning window is reached', () => {
    const expiry = getArkVtxoExpiry({
      expiryHeight: 1000 + ARK_VTXO_EXPIRY_WARNING_BLOCKS,
      lifetimeBlocks: LIFETIME_BLOCKS,
      tipHeight: 1000
    })
    expect(expiry.urgency).toBe('soon')
  })

  it('reports an expired VTXO at or past its expiry height', () => {
    expect(
      getArkVtxoExpiry({
        expiryHeight: 900,
        lifetimeBlocks: LIFETIME_BLOCKS,
        tipHeight: 1000
      })
    ).toStrictEqual({ blocksLeft: 0, elapsedRatio: 1, urgency: 'expired' })
  })

  it('treats an unknown lifetime as fully elapsed', () => {
    expect(
      getArkVtxoExpiry({
        expiryHeight: 2000,
        lifetimeBlocks: 0,
        tipHeight: 1000
      }).elapsedRatio
    ).toBe(1)
  })
})

describe('getArkVtxoEta', () => {
  it('rounds a day or more of blocks to days', () => {
    expect(getArkVtxoEta(BLOCKS_PER_DAY * 3)).toStrictEqual({
      count: 3,
      unit: 'days'
    })
  })

  it('rounds shorter waits to hours, never below one', () => {
    expect(getArkVtxoEta(12)).toStrictEqual({ count: 2, unit: 'hours' })
    expect(getArkVtxoEta(1)).toStrictEqual({ count: 1, unit: 'hours' })
  })
})

describe('buildArkVtxoLineage', () => {
  it('walks the exit chain with the siblings branching off each level', () => {
    expect(buildArkVtxoLineage(chain)).toStrictEqual([
      {
        feeSats: 0,
        inputSats: 100_000,
        outputSats: 40_000,
        siblingCount: 2,
        siblingSats: 60_000,
        signed: true,
        transition: 'cosigned',
        txid: 'root'
      },
      {
        feeSats: 0,
        inputSats: 40_000,
        outputSats: 15_000,
        siblingCount: 1,
        siblingSats: 25_000,
        signed: false,
        transition: 'roundLeaf',
        txid: 'leaf'
      }
    ])
  })

  it('is empty for a VTXO with no exit chain', () => {
    expect(buildArkVtxoLineage({ exitChain: [], genesis: [] })).toStrictEqual(
      []
    )
  })
})

describe('findArkVtxoMovements', () => {
  it('finds the movement that created and the one that spent a VTXO', () => {
    const created = buildMovement({ id: 1, outputVtxoIds: ['v:0'] })
    const spent = buildMovement({ id: 2, inputVtxoIds: ['v:0'] })
    const other = buildMovement({ id: 3, outputVtxoIds: ['w:0'] })

    expect(findArkVtxoMovements([other, created, spent], 'v:0')).toStrictEqual({
      createdBy: created,
      spentBy: spent
    })
  })

  it('counts an exit as spending the VTXO', () => {
    const exited = buildMovement({ exitedVtxoIds: ['v:0'], id: 4 })

    expect(findArkVtxoMovements([exited], 'v:0').spentBy).toBe(exited)
  })

  it('leaves both empty for an unknown VTXO', () => {
    expect(findArkVtxoMovements([buildMovement()], 'v:0')).toStrictEqual({
      createdBy: undefined,
      spentBy: undefined
    })
  })
})

describe('getArkVtxoPolicyKey', () => {
  it('reads the user key, or the internal key of an expiry policy', () => {
    expect(getArkVtxoPolicyKey({ kind: 'pubkey', userPubkey: '02aa' })).toBe(
      '02aa'
    )
    expect(getArkVtxoPolicyKey({ internalKey: '03bb', kind: 'expiry' })).toBe(
      '03bb'
    )
  })

  it('is empty for a server-owned policy', () => {
    expect(getArkVtxoPolicyKey({ kind: 'server-owned' })).toBeUndefined()
  })
})

describe('getArkVtxoPolicyPaymentHash', () => {
  it('reads the payment hash of an HTLC policy only', () => {
    expect(
      getArkVtxoPolicyPaymentHash({
        htlcExpiry: 10,
        kind: 'server-htlc-send',
        paymentHash: 'ff',
        userPubkey: '02aa'
      })
    ).toBe('ff')
    expect(
      getArkVtxoPolicyPaymentHash({ kind: 'pubkey', userPubkey: '02aa' })
    ).toBeUndefined()
  })
})

describe('getArkVtxoRoute', () => {
  it('encodes the outpoint separator in the VTXO id', () => {
    expect(getArkVtxoRoute('acc', 'ab:1')).toBe(
      '/signer/ark/account/acc/vtxo/ab%3A1'
    )
  })
})

function buildSteps(count: number): ArkVtxoLineageStep[] {
  return Array.from({ length: count }, (_, index) => ({
    feeSats: 0,
    inputSats: 1000,
    outputSats: 1000,
    siblingCount: 0,
    siblingSats: 0,
    signed: true,
    transition: 'cosigned',
    txid: `tx${index}`
  }))
}

describe('getArkVtxoLineageView', () => {
  const shortest = ARK_VTXO_LINEAGE_EDGE_STEPS * 2 + 1

  it('shows a short path in full', () => {
    const steps = buildSteps(shortest)
    expect(getArkVtxoLineageView(steps, false)).toStrictEqual({
      head: steps,
      hiddenCount: 0,
      tail: [],
      tailStartIndex: shortest
    })
  })

  it('collapses the middle of a long path', () => {
    const steps = buildSteps(10)
    const view = getArkVtxoLineageView(steps, false)
    expect(view.head.map((step) => step.txid)).toStrictEqual(['tx0', 'tx1'])
    expect(view.tail.map((step) => step.txid)).toStrictEqual(['tx8', 'tx9'])
    expect(view.hiddenCount).toBe(6)
    expect(view.tailStartIndex).toBe(8)
  })

  it('shows a long path in full once expanded', () => {
    const steps = buildSteps(10)
    const view = getArkVtxoLineageView(steps, true)
    expect(view.head).toHaveLength(10)
    expect(view.hiddenCount).toBe(0)
  })
})

describe('isArkVtxoExitUneconomical', () => {
  it('flags an exit that costs more than the VTXO', () => {
    expect(isArkVtxoExitUneconomical(2971, 4838)).toBe(true)
  })

  it('flags an exit that costs exactly the VTXO', () => {
    expect(isArkVtxoExitUneconomical(1000, 1000)).toBe(true)
  })

  it('accepts an exit that leaves sats over', () => {
    expect(isArkVtxoExitUneconomical(20_000, 4838)).toBe(false)
  })
})
