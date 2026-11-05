import {
  ARK_SWAP_BLOCK_INTERVAL_SECONDS,
  ARK_SWAP_BOARD_FEE_MAX_ROUNDS,
  ARK_SWAP_BOARD_WAIT_SAFETY_FACTOR,
  ARK_SWAP_INVOICE_MIN_REMAINING_SECONDS
} from '@/constants/ark'
import { DUST_LIMIT } from '@/constants/btc'
import {
  BOLT11_DEFAULT_EXPIRY_SECONDS,
  LIGHTNING_CHANNEL_THRESHOLD
} from '@/constants/lightning'
import { type Key } from '@/types/models/Account'
import {
  type ArkLightningToOnchainJob,
  type ArkOnchainToLightningJob
} from '@/types/models/ArkSwap'
import { type ScriptVersionType } from '@/types/models/Script'
import {
  type ArkSwapForm,
  buildArkSwapRequest,
  canDismissArkSwapJob,
  canSubmitArkSwapInvoice,
  clampArkSwapAmount,
  computeArkSwapPayout,
  computeMaxInvoiceSats,
  computeRequiredBoardSats,
  evaluateArkSwapInvoice,
  findArkSwapAccountForWallet,
  findRequiredBoardSats,
  getArkSwapAmountRange,
  getArkSwapAmountSource,
  getArkSwapDestinationKinds,
  getArkSwapHops,
  getArkSwapJobAccountId,
  getArkSwapMinSats,
  getArkSwapPayoutAddresses,
  getArkSwapPayoutOutcome,
  getArkSwapRequiredBoardSats,
  getBoardedSwapStatus,
  getLightningSendOutcome,
  hasInvoiceTimeToPay,
  isArkSwapForwardedPayment,
  isArkSwapJobRunnable,
  isArkSwapJobTerminal,
  parseArkSwapInvoice,
  resolveArkSwapRoute,
  willInvoiceOutlastBoard
} from '@/utils/arkSwap'

const NOW = 1_800_000_000
const PAYMENT_HASH = 'ab'.repeat(32)

const BASE_FORM: ArkSwapForm = {
  amountSats: 0,
  arkAccountId: 'ark-1',
  destinationAccountId: undefined,
  fromKind: 'ark',
  invoice: '',
  sourceAccountId: undefined,
  toKind: 'lightning'
}

const ONCHAIN_TO_LIGHTNING_JOB: ArkOnchainToLightningJob = {
  amountSats: 50_000,
  arkAccountId: 'ark-1',
  boardAddress: 'tb1qboard',
  createdAt: NOW,
  id: 'swap-1',
  kind: 'onchainToLightning',
  sourceAccountId: 'btc-source',
  status: 'awaitingFunding',
  updatedAt: NOW
}

const LIGHTNING_TO_ONCHAIN_JOB: ArkLightningToOnchainJob = {
  amountSats: 20_000,
  arkAccountId: 'ark-1',
  createdAt: NOW,
  destinationAccountId: 'btc-destination',
  id: 'swap-2',
  invoice: 'lntbs1invoice',
  invoiceExpiresAt: NOW + 3600,
  kind: 'lightningToOnchain',
  paymentHash: PAYMENT_HASH,
  status: 'awaitingPayment',
  updatedAt: NOW
}

const INVOICE_FIELDS = {
  amountSats: 10_000,
  expirySeconds: 600,
  invoice: 'lntbs1invoice',
  invoiceNetwork: 'signet' as const,
  paymentHash: PAYMENT_HASH,
  timestamp: NOW
}

function keyWith(scriptVersion: ScriptVersionType | undefined): Key {
  return { index: 0, iv: '', scriptVersion, secret: '' }
}

describe('resolveArkSwapRoute', () => {
  it('maps each pair of endpoints to its route', () => {
    expect(resolveArkSwapRoute('ark', 'lightning')).toBe('arkToLightning')
    expect(resolveArkSwapRoute('ark', 'onchain')).toBe('arkToOnchain')
    expect(resolveArkSwapRoute('lightning', 'ark')).toBe('lightningToArk')
    expect(resolveArkSwapRoute('lightning', 'onchain')).toBe(
      'lightningToOnchain'
    )
    expect(resolveArkSwapRoute('onchain', 'ark')).toBe('onchainToArk')
    expect(resolveArkSwapRoute('onchain', 'lightning')).toBe(
      'onchainToLightning'
    )
  })

  it('has no route to the same endpoint', () => {
    expect(resolveArkSwapRoute('ark', 'ark')).toBeUndefined()
    expect(resolveArkSwapRoute('onchain', 'onchain')).toBeUndefined()
  })
})

describe('getArkSwapDestinationKinds', () => {
  it('offers every endpoint but the source', () => {
    expect(getArkSwapDestinationKinds('ark')).toStrictEqual([
      'lightning',
      'onchain'
    ])
    expect(getArkSwapDestinationKinds('lightning')).toStrictEqual([
      'ark',
      'onchain'
    ])
    expect(getArkSwapDestinationKinds('onchain')).toStrictEqual([
      'ark',
      'lightning'
    ])
  })
})

describe('getArkSwapHops', () => {
  it('shows Ark as a hop only when it is not an endpoint', () => {
    expect(getArkSwapHops('ark', 'lightning')).toStrictEqual([
      'ark',
      'lightning'
    ])
    expect(getArkSwapHops('onchain', 'lightning')).toStrictEqual([
      'onchain',
      'ark',
      'lightning'
    ])
  })
})

describe('getArkSwapAmountSource', () => {
  it('takes the amount from the invoice when paying one from Ark', () => {
    expect(getArkSwapAmountSource('arkToLightning', '')).toBe('invoice')
  })

  it('takes the amount from the invoice only once one is given for a board', () => {
    expect(getArkSwapAmountSource('onchainToLightning', '  ')).toBe('input')
    expect(getArkSwapAmountSource('onchainToLightning', 'lntbs1')).toBe(
      'invoice'
    )
  })

  it('asks for an amount on other routes', () => {
    expect(getArkSwapAmountSource('lightningToOnchain', 'lntbs1')).toBe('input')
  })
})

describe('getArkSwapMinSats', () => {
  it('needs the Ark minimum to board and the dust limit otherwise', () => {
    expect(getArkSwapMinSats('onchain', 10_000)).toBe(10_000)
    expect(getArkSwapMinSats('ark', 10_000)).toBe(DUST_LIMIT)
    expect(getArkSwapMinSats('lightning', 10_000)).toBe(DUST_LIMIT)
  })
})

describe('getArkSwapAmountRange', () => {
  const balances = {
    arkSpendableSats: 5000,
    minBoardSats: 10_000,
    sourceBalanceSats: 20_000
  }

  it('caps by the balance the swap spends', () => {
    expect(
      getArkSwapAmountRange({ ...balances, fromKind: 'ark' })
    ).toStrictEqual({ maxSats: 5000, minSats: DUST_LIMIT })
    expect(
      getArkSwapAmountRange({ ...balances, fromKind: 'onchain' })
    ).toStrictEqual({ maxSats: 20_000, minSats: 10_000 })
    expect(
      getArkSwapAmountRange({ ...balances, fromKind: 'lightning' })
    ).toStrictEqual({
      maxSats: LIGHTNING_CHANNEL_THRESHOLD,
      minSats: DUST_LIMIT
    })
  })

  it('has no range when the balance is below the minimum', () => {
    expect(
      getArkSwapAmountRange({
        ...balances,
        fromKind: 'onchain',
        sourceBalanceSats: 9999
      })
    ).toBeUndefined()
    expect(
      getArkSwapAmountRange({
        ...balances,
        arkSpendableSats: 0,
        fromKind: 'ark'
      })
    ).toBeUndefined()
  })
})

describe('clampArkSwapAmount', () => {
  const range = { maxSats: 5000, minSats: DUST_LIMIT }

  it('keeps amounts within the maximum', () => {
    expect(clampArkSwapAmount(3000, range)).toBe(3000)
    expect(clampArkSwapAmount(8000, range)).toBe(5000)
  })

  it('is zero without a range', () => {
    expect(clampArkSwapAmount(3000, undefined)).toBe(0)
  })

  it('is zero below the minimum', () => {
    expect(clampArkSwapAmount(DUST_LIMIT - 1, range)).toBe(0)
    expect(clampArkSwapAmount(DUST_LIMIT, range)).toBe(DUST_LIMIT)
  })
})

describe('buildArkSwapRequest', () => {
  it('needs an invoice to pay from Ark', () => {
    expect(buildArkSwapRequest(BASE_FORM)).toBeUndefined()
    expect(
      buildArkSwapRequest({ ...BASE_FORM, invoice: ' lntbs1 ' })
    ).toStrictEqual({
      arkAccountId: 'ark-1',
      invoice: 'lntbs1',
      route: 'arkToLightning'
    })
  })

  it('needs a destination and an amount to send on-chain', () => {
    const form: ArkSwapForm = {
      ...BASE_FORM,
      amountSats: 5000,
      fromKind: 'lightning',
      toKind: 'onchain'
    }
    expect(buildArkSwapRequest(form)).toBeUndefined()
    expect(
      buildArkSwapRequest({ ...form, destinationAccountId: 'btc-1' })
    ).toStrictEqual({
      amountSats: 5000,
      arkAccountId: 'ark-1',
      destinationAccountId: 'btc-1',
      route: 'lightningToOnchain'
    })
  })

  it('needs an amount to receive into Ark', () => {
    const form: ArkSwapForm = {
      ...BASE_FORM,
      fromKind: 'lightning',
      toKind: 'ark'
    }
    expect(buildArkSwapRequest(form)).toBeUndefined()
    expect(buildArkSwapRequest({ ...form, amountSats: 1000 })).toStrictEqual({
      amountSats: 1000,
      arkAccountId: 'ark-1',
      route: 'lightningToArk'
    })
  })

  it('boards towards lightning with an amount or an invoice', () => {
    const form: ArkSwapForm = {
      ...BASE_FORM,
      fromKind: 'onchain',
      sourceAccountId: 'btc-1',
      toKind: 'lightning'
    }
    expect(buildArkSwapRequest(form)).toBeUndefined()
    expect(buildArkSwapRequest({ ...form, amountSats: 30_000 })).toStrictEqual({
      amountSats: 30_000,
      arkAccountId: 'ark-1',
      invoice: undefined,
      route: 'onchainToLightning',
      sourceAccountId: 'btc-1'
    })
    expect(buildArkSwapRequest({ ...form, invoice: 'lntbs1' })).toStrictEqual({
      amountSats: 0,
      arkAccountId: 'ark-1',
      invoice: 'lntbs1',
      route: 'onchainToLightning',
      sourceAccountId: 'btc-1'
    })
  })

  it('needs a source wallet to board', () => {
    expect(
      buildArkSwapRequest({
        ...BASE_FORM,
        amountSats: 30_000,
        fromKind: 'onchain',
        toKind: 'ark'
      })
    ).toBeUndefined()
  })
})

describe('job predicates', () => {
  it('treats completed and failed jobs as terminal', () => {
    expect(isArkSwapJobTerminal({ status: 'completed' })).toBe(true)
    expect(isArkSwapJobTerminal({ status: 'failed' })).toBe(true)
    expect(isArkSwapJobTerminal({ status: 'boarding' })).toBe(false)
  })

  it('does not run jobs waiting on the user for an invoice', () => {
    expect(isArkSwapJobRunnable({ status: 'awaitingInvoice' })).toBe(false)
    expect(isArkSwapJobRunnable({ status: 'awaitingFunding' })).toBe(true)
    expect(isArkSwapJobRunnable({ status: 'paying' })).toBe(true)
  })

  it('lets only jobs with nothing in flight be dismissed', () => {
    expect(canDismissArkSwapJob({ status: 'awaitingFunding' })).toBe(true)
    expect(canDismissArkSwapJob({ status: 'awaitingInvoice' })).toBe(true)
    expect(canDismissArkSwapJob({ status: 'failed' })).toBe(true)
    expect(canDismissArkSwapJob({ status: 'boarding' })).toBe(false)
    expect(canDismissArkSwapJob({ status: 'paying' })).toBe(false)
    expect(canDismissArkSwapJob({ status: 'sending' })).toBe(false)
    expect(canDismissArkSwapJob({ status: 'awaitingPayment' })).toBe(false)
  })

  it('takes a late invoice only for boards waiting for one or after a failed payment', () => {
    expect(
      canSubmitArkSwapInvoice({
        ...ONCHAIN_TO_LIGHTNING_JOB,
        status: 'awaitingInvoice'
      })
    ).toBe(true)
    expect(
      canSubmitArkSwapInvoice({ ...ONCHAIN_TO_LIGHTNING_JOB, status: 'failed' })
    ).toBe(true)
    expect(
      canSubmitArkSwapInvoice({
        ...ONCHAIN_TO_LIGHTNING_JOB,
        status: 'boarding'
      })
    ).toBe(false)
    expect(
      canSubmitArkSwapInvoice({ ...LIGHTNING_TO_ONCHAIN_JOB, status: 'failed' })
    ).toBe(false)
  })

  it('names the on-chain wallet a job uses', () => {
    expect(getArkSwapJobAccountId(ONCHAIN_TO_LIGHTNING_JOB)).toBe('btc-source')
    expect(getArkSwapJobAccountId(LIGHTNING_TO_ONCHAIN_JOB)).toBe(
      'btc-destination'
    )
  })
})

describe('findArkSwapAccountForWallet', () => {
  const arkAccounts = [
    { id: 'ark-main', network: 'bitcoin' as const },
    { id: 'ark-signet', network: 'signet' as const }
  ]

  it('picks the Ark account on the wallet network', () => {
    expect(
      findArkSwapAccountForWallet(arkAccounts, {
        keys: [keyWith('P2TR')],
        network: 'signet'
      })
    ).toBe('ark-signet')
  })

  it('skips wallets that cannot fund a board', () => {
    expect(
      findArkSwapAccountForWallet(arkAccounts, {
        keys: [keyWith('P2PKH')],
        network: 'signet'
      })
    ).toBeUndefined()
    expect(
      findArkSwapAccountForWallet(arkAccounts, {
        keys: [keyWith('P2WPKH')],
        network: 'testnet'
      })
    ).toBeUndefined()
  })
})

describe('getArkSwapPayoutOutcome', () => {
  const ADDRESS = 'tb1qpayout'

  function sentTo(address: string, status: string) {
    return { sentToAddresses: [address], status }
  }

  it('completes only once a movement to the address is successful', () => {
    expect(
      getArkSwapPayoutOutcome(
        [sentTo(ADDRESS, 'failed'), sentTo(ADDRESS, 'successful')],
        ADDRESS
      )
    ).toBe('completed')
    expect(getArkSwapPayoutOutcome([sentTo(ADDRESS, 'pending')], ADDRESS)).toBe(
      'pending'
    )
  })

  it('fails when every movement to the address failed or was canceled', () => {
    expect(
      getArkSwapPayoutOutcome(
        [sentTo(ADDRESS, 'failed'), sentTo(ADDRESS, 'canceled')],
        ADDRESS
      )
    ).toBe('failed')
  })

  it('finds nothing without a movement to the address', () => {
    expect(
      getArkSwapPayoutOutcome([sentTo('tb1qother', 'successful')], ADDRESS)
    ).toBe('notFound')
    expect(
      getArkSwapPayoutOutcome([sentTo(ADDRESS, 'successful')], undefined)
    ).toBe('notFound')
  })
})

describe('getArkSwapRequiredBoardSats', () => {
  it('gives the board amount of the swap waiting on that board', () => {
    expect(
      getArkSwapRequiredBoardSats([ONCHAIN_TO_LIGHTNING_JOB], 'tb1qboard')
    ).toBe(50_000)
  })

  it('ignores boards no waiting swap funds', () => {
    const boardingJob: ArkOnchainToLightningJob = {
      ...ONCHAIN_TO_LIGHTNING_JOB,
      status: 'boarding'
    }
    expect(
      getArkSwapRequiredBoardSats([ONCHAIN_TO_LIGHTNING_JOB], 'tb1qother')
    ).toBeUndefined()
    expect(
      getArkSwapRequiredBoardSats([boardingJob], 'tb1qboard')
    ).toBeUndefined()
  })
})

describe('getArkSwapPayoutAddresses', () => {
  it('lists the payout addresses taken from one destination wallet', () => {
    const jobs = [
      ONCHAIN_TO_LIGHTNING_JOB,
      LIGHTNING_TO_ONCHAIN_JOB,
      { ...LIGHTNING_TO_ONCHAIN_JOB, destinationAddress: 'tb1qpayout1' },
      {
        ...LIGHTNING_TO_ONCHAIN_JOB,
        destinationAccountId: 'btc-other',
        destinationAddress: 'tb1qpayout2'
      }
    ]
    expect(getArkSwapPayoutAddresses(jobs, 'btc-destination')).toStrictEqual([
      'tb1qpayout1'
    ])
  })
})

describe('isArkSwapForwardedPayment', () => {
  const jobs = [ONCHAIN_TO_LIGHTNING_JOB, LIGHTNING_TO_ONCHAIN_JOB]

  it('matches the payment of a lightning to on-chain swap', () => {
    expect(
      isArkSwapForwardedPayment(jobs, {
        accountId: 'ark-1',
        paymentHash: PAYMENT_HASH.toUpperCase()
      })
    ).toBe(true)
  })

  it('ignores payments of other accounts, hashes or swap kinds', () => {
    expect(
      isArkSwapForwardedPayment(jobs, {
        accountId: 'ark-2',
        paymentHash: PAYMENT_HASH
      })
    ).toBe(false)
    expect(
      isArkSwapForwardedPayment(jobs, {
        accountId: 'ark-1',
        paymentHash: 'ef'.repeat(32)
      })
    ).toBe(false)
    expect(
      isArkSwapForwardedPayment(
        [{ ...ONCHAIN_TO_LIGHTNING_JOB, paymentHash: PAYMENT_HASH }],
        { accountId: 'ark-1', paymentHash: PAYMENT_HASH }
      )
    ).toBe(false)
  })

  it('ignores movements without a payment hash', () => {
    expect(isArkSwapForwardedPayment(jobs, { accountId: 'ark-1' })).toBe(false)
  })
})

describe('evaluateArkSwapInvoice', () => {
  it('accepts a payable invoice and computes its expiry', () => {
    expect(evaluateArkSwapInvoice(INVOICE_FIELDS, 'signet', NOW)).toStrictEqual(
      {
        invoice: {
          amountSats: 10_000,
          expiresAt: NOW + 600,
          invoice: 'lntbs1invoice',
          paymentHash: PAYMENT_HASH
        },
        ok: true
      }
    )
  })

  it('falls back to the BOLT 11 default expiry', () => {
    const result = evaluateArkSwapInvoice(
      { ...INVOICE_FIELDS, expirySeconds: undefined },
      'signet',
      NOW
    )
    expect(result.ok && result.invoice.expiresAt).toBe(
      NOW + BOLT11_DEFAULT_EXPIRY_SECONDS
    )
  })

  it('treats an explicit zero expiry as already expired', () => {
    expect(
      evaluateArkSwapInvoice(
        { ...INVOICE_FIELDS, expirySeconds: 0 },
        'signet',
        NOW
      )
    ).toStrictEqual({ ok: false, reason: 'expired' })
  })

  it('rejects an invoice for another network', () => {
    expect(
      evaluateArkSwapInvoice(INVOICE_FIELDS, 'bitcoin', NOW)
    ).toStrictEqual({ ok: false, reason: 'wrongNetwork' })
    expect(
      evaluateArkSwapInvoice(
        { ...INVOICE_FIELDS, invoiceNetwork: null },
        'signet',
        NOW
      )
    ).toStrictEqual({ ok: false, reason: 'wrongNetwork' })
  })

  it('rejects a malformed payment hash', () => {
    expect(
      evaluateArkSwapInvoice(
        { ...INVOICE_FIELDS, paymentHash: 'AB'.repeat(32) },
        'signet',
        NOW
      )
    ).toStrictEqual({ ok: false, reason: 'invalid' })
    expect(
      evaluateArkSwapInvoice(
        { ...INVOICE_FIELDS, paymentHash: 'ab' },
        'signet',
        NOW
      )
    ).toStrictEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects amountless and expired invoices', () => {
    expect(
      evaluateArkSwapInvoice(
        { ...INVOICE_FIELDS, amountSats: 0 },
        'signet',
        NOW
      )
    ).toStrictEqual({ ok: false, reason: 'amountless' })
    expect(
      evaluateArkSwapInvoice(INVOICE_FIELDS, 'signet', NOW + 600)
    ).toStrictEqual({ ok: false, reason: 'expired' })
  })
})

describe('parseArkSwapInvoice', () => {
  it('rejects text that is not an invoice', () => {
    expect(parseArkSwapInvoice('not an invoice', 'signet', NOW)).toStrictEqual({
      ok: false,
      reason: 'invalid'
    })
  })
})

describe('invoice timing', () => {
  it('needs a minimum time left to pay', () => {
    const expiresAt = NOW + ARK_SWAP_INVOICE_MIN_REMAINING_SECONDS
    expect(hasInvoiceTimeToPay(expiresAt, NOW)).toBe(true)
    expect(hasInvoiceTimeToPay(expiresAt - 1, NOW)).toBe(false)
  })

  it('holds an invoice only when it outlives the padded board wait', () => {
    const requiredConfirmations = 2
    const boardWaitSeconds =
      requiredConfirmations *
      ARK_SWAP_BLOCK_INTERVAL_SECONDS *
      ARK_SWAP_BOARD_WAIT_SAFETY_FACTOR
    const expiresAt =
      NOW + boardWaitSeconds + ARK_SWAP_INVOICE_MIN_REMAINING_SECONDS
    expect(
      willInvoiceOutlastBoard({
        expiresAt,
        nowSeconds: NOW,
        requiredConfirmations
      })
    ).toBe(true)
    expect(
      willInvoiceOutlastBoard({
        expiresAt: expiresAt - 1,
        nowSeconds: NOW,
        requiredConfirmations
      })
    ).toBe(false)
  })

  it('pays a held invoice after boarding while it is still payable', () => {
    expect(getBoardedSwapStatus(NOW + 3600, NOW)).toBe('paying')
    expect(getBoardedSwapStatus(NOW + 10, NOW)).toBe('awaitingInvoice')
    expect(getBoardedSwapStatus(undefined, NOW)).toBe('awaitingInvoice')
  })
})

describe('computeArkSwapPayout', () => {
  it('pays out what was received minus the send fee', () => {
    expect(
      computeArkSwapPayout({ feeSats: 300, receivedSats: 10_000 })
    ).toStrictEqual({ amountSats: 9700, feeSats: 300, ok: true })
  })

  it('refuses a payout below dust', () => {
    expect(
      computeArkSwapPayout({ feeSats: 100, receivedSats: DUST_LIMIT + 99 })
    ).toStrictEqual({ ok: false, reason: 'belowDust' })
    expect(
      computeArkSwapPayout({ feeSats: 100, receivedSats: DUST_LIMIT + 100 })
    ).toStrictEqual({ amountSats: DUST_LIMIT, feeSats: 100, ok: true })
  })
})

describe('board sizing', () => {
  it('adds the lightning and board fees to the invoice', () => {
    expect(
      computeRequiredBoardSats({
        boardFeeSats: 400,
        invoiceSats: 10_000,
        lightningFeeSats: 50
      })
    ).toBe(10_450)
  })

  it('raises the board until it covers its own amount-based fee', async () => {
    const estimateBoardFeeSats = jest.fn((boardSats: number) =>
      Promise.resolve(Math.ceil(boardSats / 100))
    )
    const boardSats = await findRequiredBoardSats({
      estimateBoardFeeSats,
      invoiceSats: 10_000,
      lightningFeeSats: 50,
      minBoardSats: DUST_LIMIT
    })
    const finalFee = Math.ceil(boardSats / 100)
    expect(boardSats).toBeGreaterThanOrEqual(10_050 + finalFee)
    expect(estimateBoardFeeSats.mock.calls.length).toBeLessThanOrEqual(
      ARK_SWAP_BOARD_FEE_MAX_ROUNDS
    )
  })

  it('settles on the first round for a flat fee', async () => {
    const estimateBoardFeeSats = jest.fn(() => Promise.resolve(500))
    await expect(
      findRequiredBoardSats({
        estimateBoardFeeSats,
        invoiceSats: 10_000,
        lightningFeeSats: 50,
        minBoardSats: DUST_LIMIT
      })
    ).resolves.toBe(10_550)
    expect(estimateBoardFeeSats).toHaveBeenCalledTimes(2)
  })

  it('starts at the minimum board when the invoice is smaller', async () => {
    const estimateBoardFeeSats = jest.fn(() => Promise.resolve(500))
    await expect(
      findRequiredBoardSats({
        estimateBoardFeeSats,
        invoiceSats: 1000,
        lightningFeeSats: 50,
        minBoardSats: 20_000
      })
    ).resolves.toBe(20_000)
    expect(estimateBoardFeeSats).toHaveBeenCalledWith(20_000)
  })

  it('gives no board when the fee never settles', async () => {
    const estimateBoardFeeSats = jest.fn((boardSats: number) =>
      Promise.resolve(boardSats)
    )
    await expect(
      findRequiredBoardSats({
        estimateBoardFeeSats,
        invoiceSats: 10_000,
        lightningFeeSats: 0,
        minBoardSats: DUST_LIMIT
      })
    ).resolves.toBeUndefined()
    expect(estimateBoardFeeSats).toHaveBeenCalledTimes(
      ARK_SWAP_BOARD_FEE_MAX_ROUNDS
    )
  })
})

describe('getLightningSendOutcome', () => {
  it('completes a paid send with its preimage', () => {
    expect(
      getLightningSendOutcome({ preimage: 'cd'.repeat(32), status: 'paid' })
    ).toStrictEqual({ preimage: 'cd'.repeat(32), status: 'completed' })
  })

  it('fails an unknown send and waits on one in progress', () => {
    expect(getLightningSendOutcome({ status: 'unknown' })).toStrictEqual({
      status: 'failed'
    })
    expect(getLightningSendOutcome({ status: 'inProgress' })).toBeUndefined()
  })
})

describe('computeMaxInvoiceSats', () => {
  it('leaves room for the board and lightning fees', () => {
    expect(
      computeMaxInvoiceSats({
        boardFeeSats: 400,
        boardSats: 10_450,
        lightningFeeSats: 50
      })
    ).toBe(10_000)
  })

  it('fits the board it was computed from', () => {
    const fees = { boardFeeSats: 120, lightningFeeSats: 75 }
    const invoiceSats = computeMaxInvoiceSats({ ...fees, boardSats: 15_000 })
    expect(computeRequiredBoardSats({ ...fees, invoiceSats })).toBe(15_000)
  })

  it('never goes below zero', () => {
    expect(
      computeMaxInvoiceSats({
        boardFeeSats: 300,
        boardSats: 200,
        lightningFeeSats: 50
      })
    ).toBe(0)
  })
})
