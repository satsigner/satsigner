import { ARK_VTXO_EXPIRY_WARNING_BLOCKS } from '@/constants/ark'
import { DUST_LIMIT } from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import {
  type ArkExit,
  type ArkExitClaimRecord,
  type ArkExitStatus
} from '@/types/models/Ark'
import { type Network } from '@/types/settings/blockchain'
import {
  countArkVtxosNearExpiry,
  getArkExitBlocksUntilClaimable,
  getArkExitClaimBlocker,
  getArkExitClaimFeeRate,
  getArkExitConfirmationRatio,
  getArkExitFunding,
  getArkExitFundingAmount,
  getArkExitFundingShortfall,
  getArkExitFundingSources,
  getArkExitIncomingFundingSats,
  getArkExitStatusLine,
  getNewlyClaimableArkExitIds,
  getUnconfirmedArkExits,
  isArkExitFundingConfirming,
  isArkExitLive,
  pruneArkExitClaimRecords,
  sortArkExits,
  sumArkExitSats,
  summarizeArkExits
} from '@/utils/arkExit'

const TIP = 1000
const ACCOUNT_ID = 'ark-1'

function exit(
  vtxoId: string,
  status: ArkExitStatus,
  fields: Partial<ArkExit> = {}
): ArkExit {
  return { amountSats: 10_000, status, tipHeight: TIP, vtxoId, ...fields }
}

function claimRecord(
  vtxoIds: string[],
  fields: Partial<ArkExitClaimRecord> = {}
): ArkExitClaimRecord {
  return {
    amountSats: 9000,
    arkAccountId: ACCOUNT_ID,
    broadcastStatus: 'broadcast',
    createdAt: '2026-01-01T00:00:00.000Z',
    destinationAccountId: 'wallet-1',
    feeSats: 1000,
    inputAddresses: {},
    txHex: '00',
    txid: `txid-${vtxoIds.join('-')}`,
    vtxoIds,
    ...fields
  }
}

type FundingAccount = Pick<Account, 'id' | 'keys' | 'network' | 'summary'>

function fundingAccount(
  id: string,
  balance: number,
  {
    network = 'signet',
    satsInMempool = 0,
    creationType = 'importExtendedPub'
  }: {
    network?: Network
    satsInMempool?: number
    creationType?: Account['keys'][number]['creationType']
  } = {}
): FundingAccount {
  return {
    id,
    keys: [{ creationType, index: 0, iv: '', secret: '' }],
    network,
    summary: {
      balance,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool
    }
  }
}

describe('isArkExitLive', () => {
  it.each<[ArkExitStatus, boolean]>([
    ['starting', true],
    ['processing', true],
    ['awaitingDelta', true],
    ['claimable', true],
    ['claimInProgress', true],
    ['claimed', false],
    ['alreadySpent', false],
    ['swept', false],
    ['canceled', false]
  ])('%s is live: %s', (status, live) => {
    expect(isArkExitLive({ status })).toBe(live)
  })
})

describe('sortArkExits', () => {
  it('puts claimable exits first and finished ones last', () => {
    const sorted = sortArkExits([
      exit('done', 'claimed'),
      exit('failed', 'swept'),
      exit('moving', 'processing'),
      exit('ready', 'claimable')
    ])

    expect(sorted.map((item) => item.vtxoId)).toStrictEqual([
      'ready',
      'moving',
      'failed',
      'done'
    ])
  })
})

describe('summarizeArkExits', () => {
  it('counts claimable, live and all exits', () => {
    expect(
      summarizeArkExits([
        exit('a', 'claimable'),
        exit('b', 'processing'),
        exit('c', 'claimed')
      ])
    ).toStrictEqual({ claimableCount: 1, liveCount: 2, totalCount: 3 })
  })
})

describe('sumArkExitSats', () => {
  it('skips exits without a known amount', () => {
    expect(
      sumArkExitSats([
        exit('a', 'claimable', { amountSats: 2000 }),
        exit('b', 'claimable', { amountSats: undefined })
      ])
    ).toBe(2000)
  })
})

describe('getArkExitBlocksUntilClaimable', () => {
  it('counts the blocks left in the timelock', () => {
    expect(
      getArkExitBlocksUntilClaimable(
        exit('a', 'awaitingDelta', { claimableAtHeight: TIP + 12 })
      )
    ).toBe(12)
  })

  it('never goes below zero', () => {
    expect(
      getArkExitBlocksUntilClaimable(
        exit('a', 'awaitingDelta', { claimableAtHeight: TIP - 3 })
      )
    ).toBe(0)
  })

  it('is unknown outside the timelock', () => {
    expect(
      getArkExitBlocksUntilClaimable(
        exit('a', 'claimable', { claimableAtHeight: TIP })
      )
    ).toBeUndefined()
  })
})

describe('getArkExitConfirmationRatio', () => {
  it('is the share of confirmed exit transactions', () => {
    expect(
      getArkExitConfirmationRatio(
        exit('a', 'processing', { confirmedTxCount: 1, totalTxCount: 4 })
      )
    ).toBe(0.25)
  })

  it('is unknown without transactions or outside processing', () => {
    expect(
      getArkExitConfirmationRatio(
        exit('a', 'processing', { confirmedTxCount: 0, totalTxCount: 0 })
      )
    ).toBeUndefined()
    expect(
      getArkExitConfirmationRatio(
        exit('a', 'awaitingDelta', { confirmedTxCount: 2, totalTxCount: 2 })
      )
    ).toBeUndefined()
  })
})

describe('countArkVtxosNearExpiry', () => {
  const nearExpiry = TIP + ARK_VTXO_EXPIRY_WARNING_BLOCKS
  const farFromExpiry = nearExpiry + 1

  it('counts vtxos close to expiry', () => {
    expect(
      countArkVtxosNearExpiry(
        [{ expiryHeight: nearExpiry }, { expiryHeight: farFromExpiry }],
        TIP
      )
    ).toBe(1)
  })

  it('cannot count until the tip height is known', () => {
    expect(
      countArkVtxosNearExpiry([{ expiryHeight: nearExpiry }], undefined)
    ).toBeUndefined()
  })
})

describe('getUnconfirmedArkExits', () => {
  it('keeps exits whose transactions still have to confirm', () => {
    const exits = [
      exit('a', 'starting'),
      exit('b', 'processing'),
      exit('c', 'awaitingDelta')
    ]

    expect(
      getUnconfirmedArkExits(exits).map((item) => item.vtxoId)
    ).toStrictEqual(['a', 'b'])
  })
})

describe('getArkExitClaimBlocker', () => {
  const claimable = [exit('a', 'claimable')]

  it('waits for the exits to load', () => {
    expect(
      getArkExitClaimBlocker({
        exits: undefined,
        hasDestination: true,
        pendingClaims: []
      })
    ).toBe('loading')
  })

  it('blocks a second claim while a kept one is pending', () => {
    expect(
      getArkExitClaimBlocker({
        exits: claimable,
        hasDestination: true,
        pendingClaims: [claimRecord(['a'])]
      })
    ).toBe('claimInProgress')
  })

  it('blocks a claim while the wallet reports one in progress', () => {
    expect(
      getArkExitClaimBlocker({
        exits: [...claimable, exit('b', 'claimInProgress')],
        hasDestination: true,
        pendingClaims: []
      })
    ).toBe('claimInProgress')
  })

  it('needs a claimable exit', () => {
    expect(
      getArkExitClaimBlocker({
        exits: [exit('a', 'awaitingDelta')],
        hasDestination: true,
        pendingClaims: []
      })
    ).toBe('nothingClaimable')
  })

  it('needs a destination wallet', () => {
    expect(
      getArkExitClaimBlocker({
        exits: claimable,
        hasDestination: false,
        pendingClaims: []
      })
    ).toBe('noDestination')
  })

  it('allows a claim when nothing blocks it', () => {
    expect(
      getArkExitClaimBlocker({
        exits: claimable,
        hasDestination: true,
        pendingClaims: []
      })
    ).toBeUndefined()
  })
})

describe('pruneArkExitClaimRecords', () => {
  it('keeps a claim while all of its exits are still claimable', () => {
    const record = claimRecord(['a', 'b'])

    expect(
      pruneArkExitClaimRecords([record], ACCOUNT_ID, [
        exit('a', 'claimable'),
        exit('b', 'claimable')
      ])
    ).toStrictEqual([record])
  })

  it('drops a claim once the wallet sees its exits move on', () => {
    expect(
      pruneArkExitClaimRecords([claimRecord(['a', 'b'])], ACCOUNT_ID, [
        exit('a', 'claimInProgress'),
        exit('b', 'claimable')
      ])
    ).toStrictEqual([])
  })

  it('drops a claim whose exits the wallet no longer reports', () => {
    expect(
      pruneArkExitClaimRecords([claimRecord(['a'])], ACCOUNT_ID, [])
    ).toStrictEqual([])
  })

  it('leaves claims of other accounts alone', () => {
    const other = claimRecord(['a'], { arkAccountId: 'ark-2' })

    expect(pruneArkExitClaimRecords([other], ACCOUNT_ID, [])).toStrictEqual([
      other
    ])
  })
})

describe('getNewlyClaimableArkExitIds', () => {
  it('returns claimable exits not announced yet', () => {
    expect(
      getNewlyClaimableArkExitIds(
        [
          exit('a', 'claimable'),
          exit('b', 'claimable'),
          exit('c', 'awaitingDelta')
        ],
        ['a']
      )
    ).toStrictEqual(['b'])
  })
})

describe('getArkExitClaimFeeRate', () => {
  const rates = { fastSatPerVb: 9, regularSatPerVb: 4, slowSatPerVb: 1 }

  it('reads the rate of the chosen speed', () => {
    expect(getArkExitClaimFeeRate(rates, 'slow')).toBe(1)
    expect(getArkExitClaimFeeRate(rates, 'regular')).toBe(4)
    expect(getArkExitClaimFeeRate(rates, 'fast')).toBe(9)
  })

  it('is unknown before the rates load', () => {
    expect(getArkExitClaimFeeRate(undefined, 'fast')).toBeUndefined()
  })
})

describe('exit funding', () => {
  it('is short by what the on-chain wallet lacks', () => {
    expect(
      getArkExitFundingShortfall({
        exitBroadcastFeeSats: 5000,
        onchainConfirmedSats: 1200,
        onchainPendingSats: 0
      })
    ).toBe(3800)
    expect(
      getArkExitFundingShortfall({
        exitBroadcastFeeSats: 5000,
        onchainConfirmedSats: 9000,
        onchainPendingSats: 0
      })
    ).toBe(0)
  })

  it('counts incoming funds so the user does not send twice', () => {
    expect(
      getArkExitFundingShortfall({
        exitBroadcastFeeSats: 5000,
        onchainConfirmedSats: 1200,
        onchainPendingSats: 3000
      })
    ).toBe(800)
  })

  it('waits for confirmation once incoming funds cover the fees', () => {
    expect(
      isArkExitFundingConfirming({
        exitBroadcastFeeSats: 5000,
        onchainConfirmedSats: 1200,
        onchainPendingSats: 3800
      })
    ).toBe(true)
    expect(
      isArkExitFundingConfirming({
        exitBroadcastFeeSats: 5000,
        onchainConfirmedSats: 1200,
        onchainPendingSats: 1000
      })
    ).toBe(false)
    expect(
      isArkExitFundingConfirming({
        exitBroadcastFeeSats: 5000,
        onchainConfirmedSats: 5000,
        onchainPendingSats: 1000
      })
    ).toBe(false)
  })

  it('never funds less than dust', () => {
    expect(getArkExitFundingAmount(1)).toBe(DUST_LIMIT)
    expect(getArkExitFundingAmount(DUST_LIMIT + 1)).toBe(DUST_LIMIT + 1)
  })

  it('offers wallets on the network with coins, richest first', () => {
    const sources = getArkExitFundingSources(
      [
        fundingAccount('small', 1000),
        fundingAccount('empty', 0),
        fundingAccount('mempool', 0, { satsInMempool: 5000 }),
        fundingAccount('mainnet', 90_000, { network: 'bitcoin' }),
        fundingAccount('addressOnly', 90_000, {
          creationType: 'importAddress'
        })
      ],
      'signet'
    )

    expect(sources.map((account) => account.id)).toStrictEqual([
      'mempool',
      'small'
    ])
  })
})

describe('getArkExitFunding', () => {
  it('reports the shortfall left after confirmed and incoming funds', () => {
    expect(
      getArkExitFunding({
        exitBroadcastFeeSats: 10_000,
        onchainConfirmedSats: 3000,
        onchainPendingSats: 2000
      })
    ).toStrictEqual({
      confirming: false,
      onchainConfirmedSats: 3000,
      onchainPendingSats: 2000,
      shortfallSats: 5000
    })
  })

  it('marks funds as confirming once incoming sats cover the fee', () => {
    expect(
      getArkExitFunding({
        exitBroadcastFeeSats: 10_000,
        onchainConfirmedSats: 3000,
        onchainPendingSats: 8000
      })
    ).toMatchObject({ confirming: true, shortfallSats: 0 })
  })
})

describe('getArkExitIncomingFundingSats', () => {
  const funding = {
    confirming: true,
    onchainConfirmedSats: 0,
    onchainPendingSats: 4000,
    shortfallSats: 0
  }

  it('counts incoming sats only while they cover the fee', () => {
    expect(getArkExitIncomingFundingSats(funding)).toBe(4000)
    expect(
      getArkExitIncomingFundingSats({ ...funding, confirming: false })
    ).toBe(0)
  })

  it('is zero before the on-chain wallet was read', () => {
    expect(getArkExitIncomingFundingSats(undefined)).toBe(0)
  })
})

describe('getArkExitStatusLine', () => {
  const idle = { claimableCount: 0, liveCount: 0, totalCount: 2 }

  it('leads with exits that are ready to claim', () => {
    expect(
      getArkExitStatusLine(
        { claimableCount: 1, liveCount: 3, totalCount: 3 },
        0
      )
    ).toStrictEqual({
      count: 1,
      labelKey: 'ark.exit.summary.claimable',
      ready: true
    })
  })

  it('counts live exits when none is ready', () => {
    expect(getArkExitStatusLine({ ...idle, liveCount: 2 }, 0)).toStrictEqual({
      count: 2,
      labelKey: 'ark.exit.summary.active',
      ready: false
    })
  })

  it('falls back to pending exit sats before the exits load', () => {
    expect(getArkExitStatusLine(idle, 5000)).toStrictEqual({
      labelKey: 'ark.exit.summary.pending',
      ready: false
    })
  })

  it('says nothing once every exit is finished', () => {
    expect(getArkExitStatusLine(idle, 0)).toBeUndefined()
  })
})
