import * as barkModule from '@secondts/bark-react-native'

import '@/api/ark/providers/bark'
import { getArkProvider } from '@/api/ark/registry'
import {
  ARK_BOARD_PAYJOIN_NATIVE_MISSING,
  ARK_DAEMON_STOP_TIMEOUT_MS
} from '@/constants/ark'
import type { ArkServer, ArkWalletProvider } from '@/types/models/Ark'
import { ArkOperationBusyError } from '@/utils/arkError'

// jest.config.js maps @secondts/bark-react-native to the manual mock in
// __mocks__; these test-only helpers exist there, not in the real package.
type BarkTestHelpers = {
  __countWalletNotificationListeners: () => number
  __emitWalletNotification: (event: unknown) => void
  extractTxFromPsbt: jest.Mock
  OnchainWallet: { default_: jest.Mock }
  Wallet: { open: jest.Mock }
}

const {
  __countWalletNotificationListeners,
  __emitWalletNotification,
  extractTxFromPsbt,
  OnchainWallet,
  Wallet
} = barkModule as unknown as BarkTestHelpers

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

function createDeferred<T>(): Deferred<T> {
  const handlers: Pick<Deferred<T>, 'reject' | 'resolve'> = {
    reject: () => {},
    resolve: () => {}
  }
  const promise = new Promise<T>((resolve, reject) => {
    handlers.resolve = resolve
    handlers.reject = reject
  })
  return {
    promise,
    reject: (error) => handlers.reject(error),
    resolve: (value) => handlers.resolve(value)
  }
}

// An open checks for running releases and creates the onchain wallet before
// it reaches Wallet.open.
function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

const SERVER: ArkServer = {
  arkUrl: 'https://ark.test',
  esploraUrl: 'https://esplora.test',
  id: 'second',
  name: 'Second',
  network: 'signet'
}

const MNEMONIC = 'test test test test test test test test test test test junk'

type FakeWallet = Record<string, jest.Mock>

function buildFakeWallet(overrides: Partial<FakeWallet> = {}): FakeWallet {
  return {
    allVtxos: jest.fn().mockResolvedValue([]),
    arkInfo: jest.fn().mockResolvedValue(undefined),
    balance: jest.fn(),
    bolt11Invoice: jest.fn(),
    estimateArkoorPaymentFee: jest.fn(),
    getExitVtxos: jest.fn().mockResolvedValue([]),
    history: jest.fn().mockResolvedValue([]),
    newAddress: jest.fn(),
    offboardVtxos: jest.fn(),
    payLightningInvoice: jest.fn(),
    peekAddress: jest.fn(),
    sendArkoorPayment: jest.fn(),
    sendOnchain: jest.fn(),
    spendableVtxos: jest.fn().mockResolvedValue([]),
    sync: jest.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

function buildFakeVtxo(id: string, amountSats: bigint, expiryHeight: number) {
  return {
    amountSats,
    expiryHeight,
    id,
    kind: 'k',
    state: { tag: 'Spendable' }
  }
}

const provider: ArkWalletProvider = getArkProvider('second')

async function openWallet(
  accountId: string,
  wallet: FakeWallet
): Promise<void> {
  Wallet.open.mockResolvedValue(wallet)
  await provider.openWallet({
    accountId,
    datadir: `/tmp/${accountId}`,
    mnemonic: MNEMONIC,
    server: SERVER
  })
}

function movementCreatedEvent(
  subsystemKind: string,
  subsystemName = '',
  paymentHash?: string
) {
  return {
    inner: {
      movement: {
        effectiveBalanceSats: 0n,
        id: 1,
        paymentHash,
        status: 'pending',
        subsystemKind,
        subsystemName
      }
    },
    tag: 'MovementCreated'
  }
}

describe('bark provider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Wallet.open.mockReset()
  })

  it('createWallet starts the daemon so live notifications work', async () => {
    Wallet.open.mockResolvedValue(buildFakeWallet())
    await provider.createWallet({
      accountId: 'create1',
      datadir: '/tmp/create1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    expect(Wallet.open).toHaveBeenCalledWith(
      expect.anything(),
      MNEMONIC,
      expect.anything(),
      expect.objectContaining({ runDaemon: true })
    )
  })

  it('fetchBalance converts bigint fields to numbers', async () => {
    const wallet = buildFakeWallet({
      balance: jest.fn().mockResolvedValue({
        claimableLightningReceiveSats: 1n,
        needsRefreshSats: 6n,
        pendingArkoorSendSats: 7n,
        pendingBoardSats: 2n,
        pendingExitSats: 3n,
        pendingInRoundSats: 4n,
        pendingLightningSendSats: 5n,
        pendingOffboardSats: 8n,
        spendableSats: 21_000_000n
      })
    })
    await openWallet('bal1', wallet)
    await expect(provider.fetchBalance('bal1')).resolves.toStrictEqual({
      claimableLightningReceiveSats: 1,
      needsRefreshSats: 6,
      pendingArkoorSendSats: 7,
      pendingBoardSats: 2,
      pendingExitSats: 3,
      pendingInRoundSats: 4,
      pendingLightningSendSats: 5,
      pendingOffboardSats: 8,
      spendableSats: 21_000_000
    })
  })

  async function openWalletWithOnchainFeeRate(
    accountId: string,
    regularSatPerKwu: bigint
  ): Promise<void> {
    OnchainWallet.default_.mockResolvedValueOnce({
      balance: jest.fn(),
      feeRates: jest.fn().mockResolvedValue({
        fastSatPerKwu: regularSatPerKwu * 2n,
        regularSatPerKwu,
        slowSatPerKwu: regularSatPerKwu / 2n
      }),
      newAddress: jest.fn(),
      sync: jest.fn()
    })
    await openWallet(accountId, buildFakeWallet())
  }

  it('fetchOnchainFeeRate converts sat/kwu to sat/vB rounding up', async () => {
    await openWalletWithOnchainFeeRate('onchainFee1', 1001n)
    await expect(provider.fetchOnchainFeeRate('onchainFee1')).resolves.toBe(5)
  })

  it('fetchOnchainFeeRate never goes below 1 sat/vB', async () => {
    await openWalletWithOnchainFeeRate('onchainFee2', 100n)
    await expect(provider.fetchOnchainFeeRate('onchainFee2')).resolves.toBe(1)
  })

  it('startExit exits the entire wallet only when ids are omitted', async () => {
    const wallet = buildFakeWallet({
      startExitForEntireWallet: jest.fn().mockResolvedValue(undefined),
      startExitForVtxos: jest.fn().mockResolvedValue(undefined)
    })
    await openWallet('exit1', wallet)

    await provider.startExit('exit1')
    expect(wallet.startExitForEntireWallet).toHaveBeenCalledTimes(1)
    expect(wallet.startExitForVtxos).not.toHaveBeenCalled()

    await provider.startExit('exit1', ['vtxo-1'])
    expect(wallet.startExitForVtxos).toHaveBeenCalledWith(['vtxo-1'])

    await expect(provider.startExit('exit1', [])).rejects.toThrow(
      'No VTXOs selected for exit'
    )
    expect(wallet.startExitForEntireWallet).toHaveBeenCalledTimes(1)
  })

  it('fetchMovements maps native movements including bigint amounts', async () => {
    const wallet = buildFakeWallet({
      history: jest.fn().mockResolvedValue([
        {
          completedAt: undefined,
          createdAt: '2026-01-01T00:00:00.000Z',
          effectiveBalanceSats: -1500n,
          exitedVtxoIds: [],
          id: 7,
          inputVtxoIds: ['vtxo1'],
          intendedBalanceSats: -1400n,
          metadataJson: '{}',
          offchainFeeSats: 100n,
          outputVtxoIds: ['vtxo2'],
          receivedOnAddresses: [],
          sentToAddresses: ['ark1dest'],
          status: 'successful',
          subsystemKind: 'arkoor',
          subsystemName: 'bark.send',
          updatedAt: '2026-01-01T00:01:00.000Z'
        }
      ])
    })
    await openWallet('mov1', wallet)
    const movements = await provider.fetchMovements('mov1')
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({
      completedAt: null,
      effectiveBalanceSats: -1500,
      id: 7,
      intendedBalanceSats: -1400,
      offchainFeeSats: 100
    })
  })

  it('estimateArkoorFee maps the native fee estimate', async () => {
    const wallet = buildFakeWallet({
      estimateArkoorPaymentFee: jest.fn().mockResolvedValue({
        feeSats: 12n,
        grossAmountSats: 1012n,
        netAmountSats: 1000n,
        vtxosSpent: ['vtxo1']
      })
    })
    await openWallet('fee1', wallet)
    await expect(
      provider.estimateArkoorFee('fee1', 1000)
    ).resolves.toStrictEqual({
      feeSats: 12,
      grossAmountSats: 1012,
      netAmountSats: 1000,
      vtxoIdsSpent: ['vtxo1']
    })
    expect(wallet.estimateArkoorPaymentFee).toHaveBeenCalledWith(1000n)
  })

  it('boardFundingAddress maps the native funding info', async () => {
    const wallet = buildFakeWallet({
      boardFundingAddress: jest.fn().mockResolvedValue({
        address: 'bc1pboard',
        expiryHeight: 900_000,
        keypairIndex: 3
      }),
      boardPsbt: jest.fn()
    })
    await openWallet('boardaddr1', wallet)
    await expect(
      provider.boardFundingAddress('boardaddr1')
    ).resolves.toStrictEqual({
      address: 'bc1pboard',
      expiryHeight: 900_000,
      keypairIndex: 3
    })
  })

  it('boardFundingAddress errors when the native method is missing', async () => {
    const wallet = buildFakeWallet()
    await openWallet('boardaddr-missing', wallet)
    await expect(
      provider.boardFundingAddress('boardaddr-missing')
    ).rejects.toThrow(ARK_BOARD_PAYJOIN_NATIVE_MISSING)
  })

  it('boardPsbt passes the keypair index and expiry height through unchanged', async () => {
    const wallet = buildFakeWallet({
      boardFundingAddress: jest.fn(),
      boardPsbt: jest.fn().mockResolvedValue({
        amountSats: 50_000n,
        txid: 'txid-board-psbt',
        vtxoId: 'vtxo-board'
      })
    })
    await openWallet('boardpsbt1', wallet)
    await expect(
      provider.boardPsbt('boardpsbt1', 'psbt-base64', 3, 900_000)
    ).resolves.toStrictEqual({
      amountSats: 50_000,
      txid: 'txid-board-psbt',
      vtxoId: 'vtxo-board'
    })
    expect(wallet.boardPsbt).toHaveBeenCalledWith('psbt-base64', 3, 900_000)
  })

  it('listAllVtxos flags spendable vtxos from the spendable set', async () => {
    const vtxoA = buildFakeVtxo('a', 100n, 10)
    const vtxoB = buildFakeVtxo('b', 200n, 20)
    const wallet = buildFakeWallet({
      allVtxos: jest.fn().mockResolvedValue([vtxoA, vtxoB]),
      spendableVtxos: jest.fn().mockResolvedValue([vtxoA])
    })
    await openWallet('vtxo1', wallet)
    const vtxos = await provider.listAllVtxos('vtxo1')
    expect(vtxos.map((v) => [v.id, v.spendable, v.amountSats])).toStrictEqual([
      ['a', true, 100],
      ['b', false, 200]
    ])
  })

  it('listAllVtxos keeps exiting and round-queued vtxos out of selection', async () => {
    const free = buildFakeVtxo('free', 100n, 10)
    const exiting = buildFakeVtxo('exiting', 200n, 20)
    const locked = buildFakeVtxo('locked', 300n, 30)
    const queued = buildFakeVtxo('queued', 350n, 35)
    const canceled = buildFakeVtxo('canceled', 400n, 40)
    const wallet = buildFakeWallet({
      allVtxos: jest
        .fn()
        .mockResolvedValue([free, exiting, locked, queued, canceled]),
      getExitVtxos: jest.fn().mockResolvedValue([
        { state: { tag: 'Processing' }, vtxoId: 'exiting' },
        { state: { tag: 'Canceled' }, vtxoId: 'canceled' }
      ]),
      history: jest.fn().mockResolvedValue([
        {
          effectiveBalanceSats: 0n,
          exitedVtxoIds: [],
          id: 7,
          inputVtxoIds: ['queued'],
          intendedBalanceSats: 0n,
          offchainFeeSats: 0n,
          outputVtxoIds: [],
          receivedOnAddresses: [],
          sentToAddresses: [],
          status: 'pending',
          subsystemKind: 'round',
          subsystemName: 'bark.refresh'
        }
      ]),
      spendableVtxos: jest
        .fn()
        .mockResolvedValue([free, exiting, queued, canceled])
    })
    await openWallet('busy1', wallet)
    const vtxos = await provider.listAllVtxos('busy1')
    expect(vtxos.map((v) => [v.id, v.spendable])).toStrictEqual([
      ['free', true],
      ['exiting', false],
      ['locked', false],
      ['queued', false],
      ['canceled', true]
    ])
  })

  it('fetchBalance moves exiting vtxo sats from spendable to pending exit', async () => {
    const wallet = buildFakeWallet({
      balance: jest.fn().mockResolvedValue({
        claimableLightningReceiveSats: 0n,
        needsRefreshSats: 0n,
        pendingArkoorSendSats: 0n,
        pendingBoardSats: 0n,
        pendingExitSats: 0n,
        pendingInRoundSats: 0n,
        pendingLightningSendSats: 0n,
        pendingOffboardSats: 0n,
        spendableSats: 27_000n
      }),
      getExitVtxos: jest
        .fn()
        .mockResolvedValue([
          { state: { tag: 'Processing' }, vtxoId: 'exiting' }
        ]),
      spendableVtxos: jest
        .fn()
        .mockResolvedValue([
          buildFakeVtxo('free', 25_000n, 10),
          buildFakeVtxo('exiting', 2000n, 20)
        ])
    })
    await openWallet('busy2', wallet)
    await expect(provider.fetchBalance('busy2')).resolves.toMatchObject({
      pendingExitSats: 2000,
      spendableSats: 25_000
    })
  })

  it('fetchBalance takes a queued refresh of a too-deep vtxo from needs-refresh', async () => {
    const wallet = buildFakeWallet({
      arkInfo: jest.fn().mockResolvedValue({ maxVtxoExitDepth: 10 }),
      balance: jest.fn().mockResolvedValue({
        claimableLightningReceiveSats: 0n,
        needsRefreshSats: 5000n,
        pendingArkoorSendSats: 0n,
        pendingBoardSats: 0n,
        pendingExitSats: 0n,
        pendingInRoundSats: 0n,
        pendingLightningSendSats: 0n,
        pendingOffboardSats: 0n,
        spendableSats: 10_000n
      }),
      history: jest.fn().mockResolvedValue([
        {
          inputVtxoIds: ['deep'],
          status: 'pending',
          subsystemKind: 'round',
          subsystemName: 'bark.refresh'
        }
      ]),
      spendableVtxos: jest.fn().mockResolvedValue([
        { ...buildFakeVtxo('free', 10_000n, 500), exitDepth: 1 },
        { ...buildFakeVtxo('deep', 5000n, 500), exitDepth: 10 }
      ])
    })
    await openWallet('busy3', wallet)
    await expect(provider.fetchBalance('busy3')).resolves.toMatchObject({
      needsRefreshSats: 0,
      pendingInRoundSats: 5000,
      spendableSats: 10_000
    })
  })

  it('fetchBalance skips the refresh thresholds when no vtxo is busy', async () => {
    const wallet = buildFakeWallet({
      balance: jest.fn().mockResolvedValue({
        claimableLightningReceiveSats: 0n,
        needsRefreshSats: 0n,
        pendingArkoorSendSats: 0n,
        pendingBoardSats: 0n,
        pendingExitSats: 0n,
        pendingInRoundSats: 0n,
        pendingLightningSendSats: 0n,
        pendingOffboardSats: 0n,
        spendableSats: 1000n
      }),
      spendableVtxos: jest
        .fn()
        .mockResolvedValue([buildFakeVtxo('free', 1000n, 10)])
    })
    await openWallet('busy4', wallet)
    await expect(provider.fetchBalance('busy4')).resolves.toMatchObject({
      spendableSats: 1000
    })
    expect(wallet.arkInfo).not.toHaveBeenCalled()
  })

  it('fetchVtxoState returns the state tag of the VTXO', async () => {
    const wallet = buildFakeWallet({
      getVtxoById: jest.fn().mockResolvedValue({
        ...buildFakeVtxo('board', 100n, 10),
        state: { tag: 'Locked' }
      })
    })
    await openWallet('vtxostate1', wallet)
    await expect(provider.fetchVtxoState('vtxostate1', 'board')).resolves.toBe(
      'Locked'
    )
    expect(wallet.getVtxoById).toHaveBeenCalledWith('board')
  })

  it('payBolt11 returns the preimage and given amount for a Paid status', async () => {
    const wallet = buildFakeWallet({
      payLightningInvoice: jest.fn().mockResolvedValue({
        inner: { paymentHash: 'hash', preimage: 'preimage1' },
        tag: 'Paid'
      })
    })
    await openWallet('pay1', wallet)
    await expect(
      provider.payBolt11('pay1', 'lnbc1invoice', 400)
    ).resolves.toStrictEqual({
      amountSats: 400,
      htlcVtxoCount: 0,
      invoice: 'lnbc1invoice',
      preimage: 'preimage1'
    })
  })

  it('payBolt11 maps an InProgress status from the native send', async () => {
    const wallet = buildFakeWallet({
      payLightningInvoice: jest.fn().mockResolvedValue({
        inner: {
          send: { amountSats: 700n, htlcVtxoCount: 2, invoice: 'lnbc1x' }
        },
        tag: 'InProgress'
      })
    })
    await openWallet('pay2', wallet)
    await expect(
      provider.payBolt11('pay2', 'lnbc1x', 700)
    ).resolves.toStrictEqual({
      amountSats: 700,
      htlcVtxoCount: 2,
      invoice: 'lnbc1x'
    })
  })

  it('payBolt11 falls back to 0 for an amountless send with an undecodable invoice', async () => {
    const wallet = buildFakeWallet({
      payLightningInvoice: jest.fn().mockResolvedValue({
        inner: { paymentHash: 'hash', preimage: 'preimage2' },
        tag: 'Paid'
      })
    })
    await openWallet('pay3', wallet)
    const result = await provider.payBolt11('pay3', 'not-an-invoice')
    expect(result.amountSats).toBe(0)
    expect(result.preimage).toBe('preimage2')
  })

  it('a failed initial sync evicts the wallet so the next open retries', async () => {
    const failing = buildFakeWallet({
      sync: jest.fn().mockRejectedValue(new Error('network down'))
    })
    Wallet.open.mockResolvedValueOnce(failing)
    await expect(
      provider.openWallet({
        accountId: 'retry1',
        datadir: '/tmp/retry1',
        mnemonic: MNEMONIC,
        server: SERVER
      })
    ).rejects.toThrow('network down')

    const healthy = buildFakeWallet()
    Wallet.open.mockResolvedValueOnce(healthy)
    await expect(
      provider.openWallet({
        accountId: 'retry1',
        datadir: '/tmp/retry1',
        mnemonic: MNEMONIC,
        server: SERVER
      })
    ).resolves.toBeUndefined()
    expect(Wallet.open).toHaveBeenCalledTimes(2)
    expect(healthy.sync).toHaveBeenCalledTimes(1)
  })

  it('makes a second caller wait while the first open still syncs', async () => {
    const syncGate = createDeferred<undefined>()
    const failing = buildFakeWallet({
      sync: jest.fn().mockReturnValueOnce(syncGate.promise)
    })
    Wallet.open.mockResolvedValueOnce(failing)
    const args = {
      accountId: 'concurrent1',
      datadir: '/tmp/concurrent1',
      mnemonic: MNEMONIC,
      server: SERVER
    }
    const first = provider.openWallet(args)
    await Promise.resolve()
    await Promise.resolve()
    const second = provider.openWallet(args)

    syncGate.reject(new Error('network down'))

    await expect(first).rejects.toThrow('network down')
    await expect(second).rejects.toThrow('network down')
  })

  it('stops and destroys a wallet whose open finished after it was released', async () => {
    const openGate = createDeferred<FakeWallet>()
    const wallet = buildFakeWallet({
      stopDaemonWait: jest.fn().mockResolvedValue(undefined)
    })
    Wallet.open.mockReturnValueOnce(openGate.promise)
    const opening = provider.openWallet({
      accountId: 'released1',
      datadir: '/tmp/released1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    await flushPromises()
    expect(Wallet.open).toHaveBeenCalledTimes(1)

    provider.releaseWallet('released1')
    openGate.resolve(wallet)

    await expect(opening).rejects.toThrow('released while it was opening')
    expect(wallet.stopDaemonWait).toHaveBeenCalledTimes(1)
    await expect(provider.fetchBalance('released1')).rejects.toThrow(
      'not opened'
    )
  })

  it('skips the native open of a wallet released before it got there', async () => {
    const opening = provider.openWallet({
      accountId: 'releasedEarly1',
      datadir: '/tmp/releasedEarly1',
      mnemonic: MNEMONIC,
      server: SERVER
    })

    provider.releaseWallet('releasedEarly1')

    await expect(opening).rejects.toThrow('released while it was opening')
    expect(Wallet.open).not.toHaveBeenCalled()
  })

  it('releaseAllWallets stops every daemon before releasing the wallets', async () => {
    const calls: string[] = []
    const first = buildFakeWallet({
      stopDaemonWait: jest.fn(() => {
        calls.push('stop first')
        return Promise.resolve()
      })
    })
    const second = buildFakeWallet({
      stopDaemonWait: jest.fn().mockRejectedValue(new Error('not running'))
    })
    await openWallet('releaseAll1', first)
    await openWallet('releaseAll2', second)

    await provider.releaseAllWallets()

    expect(calls).toStrictEqual(['stop first'])
    expect(second.stopDaemonWait).toHaveBeenCalledTimes(1)
    await expect(provider.fetchBalance('releaseAll1')).rejects.toThrow(
      'not opened'
    )
    await expect(provider.fetchBalance('releaseAll2')).rejects.toThrow(
      'not opened'
    )
  })

  it('releaseAllWallets gives up on a daemon that never stops', async () => {
    jest.useFakeTimers()
    try {
      const stuck = buildFakeWallet({
        stopDaemonWait: jest.fn(() => new Promise<void>(() => {}))
      })
      await openWallet('releaseStuck1', stuck)

      const releasing = provider.releaseAllWallets()
      await jest.advanceTimersByTimeAsync(ARK_DAEMON_STOP_TIMEOUT_MS)

      await expect(releasing).resolves.toBeUndefined()
      await expect(provider.fetchBalance('releaseStuck1')).rejects.toThrow(
        'not opened'
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('releaseAllWallets makes a reopen wait for the daemon and open anew', async () => {
    const stopGate = createDeferred<undefined>()
    const stopping = buildFakeWallet({
      stopDaemonWait: jest.fn().mockReturnValue(stopGate.promise)
    })
    await openWallet('releaseSlow1', stopping)

    const releasing = provider.releaseAllWallets()
    const reopened = buildFakeWallet()
    Wallet.open.mockResolvedValue(reopened)
    const reopening = provider.openWallet({
      accountId: 'releaseSlow1',
      datadir: '/tmp/releaseSlow1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    await Promise.resolve()
    expect(Wallet.open).toHaveBeenCalledTimes(1)

    stopGate.resolve(undefined)
    await releasing
    await reopening

    expect(Wallet.open).toHaveBeenCalledTimes(2)
    expect(reopened.sync).toHaveBeenCalledTimes(1)
    await expect(provider.syncWallet('releaseSlow1')).resolves.toBeUndefined()
    expect(stopping.sync).toHaveBeenCalledTimes(1)
  })

  it('releaseAllWallets waits for an open it cancelled to stop its daemon', async () => {
    const openGate = createDeferred<FakeWallet>()
    const late = buildFakeWallet({
      stopDaemonWait: jest.fn().mockResolvedValue(undefined)
    })
    Wallet.open.mockReturnValueOnce(openGate.promise)
    const opening = provider.openWallet({
      accountId: 'releaseOpening1',
      datadir: '/tmp/releaseOpening1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    await flushPromises()

    const released = jest.fn()
    const releasing = provider.releaseAllWallets().then(released)
    await flushPromises()
    expect(released).not.toHaveBeenCalled()

    openGate.resolve(late)
    await releasing

    await expect(opening).rejects.toThrow('released while it was opening')
    expect(late.stopDaemonWait).toHaveBeenCalledTimes(1)
    await expect(provider.fetchBalance('releaseOpening1')).rejects.toThrow(
      'not opened'
    )
  })

  it('releaseAllWallets makes the next open start anew, not join a cancelled one', async () => {
    const openGate = createDeferred<FakeWallet>()
    Wallet.open.mockReturnValueOnce(openGate.promise)
    const cancelled = provider.openWallet({
      accountId: 'releaseJoin1',
      datadir: '/tmp/releaseJoin1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    await flushPromises()

    const releasing = provider.releaseAllWallets()
    const reopened = buildFakeWallet()
    Wallet.open.mockResolvedValue(reopened)
    const reopening = provider.openWallet({
      accountId: 'releaseJoin1',
      datadir: '/tmp/releaseJoin1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    await flushPromises()
    expect(Wallet.open).toHaveBeenCalledTimes(1)

    openGate.resolve(buildFakeWallet())
    await releasing

    await expect(cancelled).rejects.toThrow('released while it was opening')
    await expect(reopening).resolves.toBeUndefined()
    expect(Wallet.open).toHaveBeenCalledTimes(2)
    await expect(provider.syncWallet('releaseJoin1')).resolves.toBeUndefined()
    expect(reopened.sync).toHaveBeenCalledTimes(2)
  })

  it('releaseAllWallets cancels an open still waiting on an earlier release', async () => {
    const stopGate = createDeferred<undefined>()
    const stopping = buildFakeWallet({
      stopDaemonWait: jest.fn().mockReturnValue(stopGate.promise)
    })
    await openWallet('releaseTwice1', stopping)

    const firstRelease = provider.releaseAllWallets()
    const waiting = provider.openWallet({
      accountId: 'releaseTwice1',
      datadir: '/tmp/releaseTwice1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    const secondRelease = provider.releaseAllWallets()
    stopGate.resolve(undefined)
    await Promise.all([firstRelease, secondRelease])

    await expect(waiting).rejects.toThrow('released while it was opening')
    expect(Wallet.open).toHaveBeenCalledTimes(1)
  })

  it('releaseAllWallets cancels a wallet still being created', async () => {
    const openGate = createDeferred<FakeWallet>()
    const created = buildFakeWallet({
      stopDaemonWait: jest.fn().mockResolvedValue(undefined)
    })
    Wallet.open.mockReturnValueOnce(openGate.promise)
    const creating = provider.createWallet({
      accountId: 'releaseCreating1',
      datadir: '/tmp/releaseCreating1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    await flushPromises()

    const releasing = provider.releaseAllWallets()
    openGate.resolve(created)
    await releasing

    await expect(creating).rejects.toThrow('released while it was opening')
    expect(created.stopDaemonWait).toHaveBeenCalledTimes(1)
    await expect(provider.fetchBalance('releaseCreating1')).rejects.toThrow(
      'not opened'
    )
  })

  it('releaseAllWallets waits for an earlier release still stopping its daemons', async () => {
    const stopGate = createDeferred<undefined>()
    const stopping = buildFakeWallet({
      stopDaemonWait: jest.fn().mockReturnValue(stopGate.promise)
    })
    await openWallet('releaseEarlier1', stopping)

    const firstRelease = provider.releaseAllWallets()
    const secondReleased = jest.fn()
    const secondRelease = provider.releaseAllWallets().then(secondReleased)
    await flushPromises()
    expect(secondReleased).not.toHaveBeenCalled()

    stopGate.resolve(undefined)
    await Promise.all([firstRelease, secondRelease])
    expect(secondReleased).toHaveBeenCalledTimes(1)
  })

  it('a sync still running on a released wallet is not joined by the next wallet', async () => {
    const syncGate = createDeferred<undefined>()
    const released = buildFakeWallet({
      sync: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockReturnValueOnce(syncGate.promise)
    })
    await openWallet('releaseSync1', released)
    const staleSync = provider.syncWallet('releaseSync1')

    await provider.releaseAllWallets()
    const next = buildFakeWallet()
    await openWallet('releaseSync1', next)
    await provider.syncWallet('releaseSync1')

    expect(next.sync).toHaveBeenCalledTimes(2)
    syncGate.resolve(undefined)
    await staleSync
  })

  it('releaseAllWallets fails an open whose first sync was still running', async () => {
    const syncGate = createDeferred<undefined>()
    const syncing = buildFakeWallet({
      stopDaemonWait: jest.fn().mockResolvedValue(undefined),
      sync: jest.fn().mockReturnValue(syncGate.promise)
    })
    Wallet.open.mockResolvedValueOnce(syncing)
    const opening = provider.openWallet({
      accountId: 'releaseSyncing1',
      datadir: '/tmp/releaseSyncing1',
      mnemonic: MNEMONIC,
      server: SERVER
    })
    await flushPromises()
    expect(syncing.sync).toHaveBeenCalledTimes(1)

    const releasing = provider.releaseAllWallets()
    syncGate.resolve(undefined)
    await releasing

    await expect(opening).rejects.toThrow('released while it was opening')
    expect(syncing.stopDaemonWait).toHaveBeenCalledTimes(1)
  })

  it('a cancelled open whose first sync fails keeps the next wallet cached', async () => {
    jest.useFakeTimers()
    try {
      const syncGate = createDeferred<undefined>()
      const syncing = buildFakeWallet({
        stopDaemonWait: jest.fn().mockResolvedValue(undefined),
        sync: jest.fn().mockReturnValue(syncGate.promise)
      })
      Wallet.open.mockResolvedValueOnce(syncing)
      const cancelled = provider.openWallet({
        accountId: 'releaseSyncFail1',
        datadir: '/tmp/releaseSyncFail1',
        mnemonic: MNEMONIC,
        server: SERVER
      })
      await jest.advanceTimersByTimeAsync(0)
      expect(syncing.sync).toHaveBeenCalledTimes(1)

      const releasing = provider.releaseAllWallets()
      await jest.advanceTimersByTimeAsync(ARK_DAEMON_STOP_TIMEOUT_MS)
      await releasing
      const next = buildFakeWallet()
      Wallet.open.mockResolvedValueOnce(next)
      await provider.openWallet({
        accountId: 'releaseSyncFail1',
        datadir: '/tmp/releaseSyncFail1',
        mnemonic: MNEMONIC,
        server: SERVER
      })

      syncGate.reject(new Error('sync failed'))
      await expect(cancelled).rejects.toThrow('sync failed')
      await expect(
        provider.syncWallet('releaseSyncFail1')
      ).resolves.toBeUndefined()
      expect(next.sync).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('concurrent syncWallet calls are coalesced into one native sync', async () => {
    const firstGate = createDeferred<undefined>()
    const secondGate = createDeferred<undefined>()
    const wallet = buildFakeWallet({
      sync: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockReturnValueOnce(firstGate.promise)
        .mockReturnValueOnce(secondGate.promise)
    })
    await openWallet('sync1', wallet)

    const first = provider.syncWallet('sync1')
    const second = provider.syncWallet('sync1')
    expect(wallet.sync).toHaveBeenCalledTimes(2)
    firstGate.resolve(undefined)
    await Promise.all([first, second])

    const third = provider.syncWallet('sync1')
    expect(wallet.sync).toHaveBeenCalledTimes(3)
    secondGate.resolve(undefined)
    await third
  })

  it('offboardVtxos resolves with the txid when the wallet finishes first', async () => {
    const wallet = buildFakeWallet({
      offboardVtxos: jest.fn().mockResolvedValue({ txid: 'txid-offboard' })
    })
    await openWallet('off1', wallet)
    await expect(
      provider.offboardVtxos('off1', ['vtxo1'], 'tb1qdest')
    ).resolves.toBe('txid-offboard')
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('subscribeNotifications forwards the movement payment hash', async () => {
    await openWallet('notify1', buildFakeWallet())
    const listener = jest.fn()
    const unsubscribe = provider.subscribeNotifications('notify1', listener)
    __emitWalletNotification(
      movementCreatedEvent('lightning_receive', '', 'ab')
    )
    unsubscribe()
    expect(listener).toHaveBeenCalledWith({
      accountId: 'notify1',
      effectiveBalanceSats: 0,
      movementId: 1,
      paymentHash: 'ab',
      status: 'pending',
      subsystemKind: 'lightning_receive',
      subsystemName: '',
      type: 'created'
    })
  })

  it('offboardVtxos resolves pending when the movement notification wins', async () => {
    const wallet = buildFakeWallet({
      offboardVtxos: jest.fn().mockReturnValue(new Promise(() => {}))
    })
    await openWallet('off2', wallet)
    const pending = provider.offboardVtxos('off2', ['vtxo1'], 'tb1qdest')
    __emitWalletNotification(movementCreatedEvent('offboard'))
    await expect(pending).resolves.toBe('pending')
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('offboardVtxos ignores movement notifications of other subsystems', async () => {
    const wallet = buildFakeWallet({
      offboardVtxos: jest.fn().mockResolvedValue({ txid: 'txid-late' })
    })
    await openWallet('off3', wallet)
    const pending = provider.offboardVtxos('off3', ['vtxo1'], 'tb1qdest')
    __emitWalletNotification(movementCreatedEvent('arkoor'))
    await expect(pending).resolves.toBe('txid-late')
  })

  it('offboardVtxos rejects when the wallet operation fails first', async () => {
    const wallet = buildFakeWallet({
      offboardVtxos: jest.fn().mockRejectedValue(new Error('broadcast failed'))
    })
    await openWallet('off4', wallet)
    await expect(
      provider.offboardVtxos('off4', ['vtxo1'], 'tb1qdest')
    ).rejects.toThrow('broadcast failed')
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('a late wallet failure after the notification win is swallowed', async () => {
    const walletOp = createDeferred<string>()
    const wallet = buildFakeWallet({
      offboardVtxos: jest.fn().mockReturnValue(walletOp.promise)
    })
    await openWallet('off5', wallet)
    const pending = provider.offboardVtxos('off5', ['vtxo1'], 'tb1qdest')
    __emitWalletNotification(movementCreatedEvent('offboard'))
    await expect(pending).resolves.toBe('pending')
    walletOp.reject(new Error('late failure'))
    await Promise.resolve()
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('refreshVtxos resolves with the txid when the wallet finishes first', async () => {
    const wallet = buildFakeWallet({
      refreshVtxos: jest.fn().mockResolvedValue('txid-refresh')
    })
    await openWallet('ref1', wallet)
    await expect(provider.refreshVtxos('ref1', ['vtxo1'])).resolves.toBe(
      'txid-refresh'
    )
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('refreshVtxos resolves pending when the refresh movement notification wins', async () => {
    const wallet = buildFakeWallet({
      refreshVtxos: jest.fn().mockReturnValue(new Promise(() => {}))
    })
    await openWallet('ref2', wallet)
    const pending = provider.refreshVtxos('ref2', ['vtxo1'])
    __emitWalletNotification(movementCreatedEvent('round', 'bark.refresh'))
    await expect(pending).resolves.toBe('pending')
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('refreshVtxos resolves pending on a round movement with the refresh kind', async () => {
    const wallet = buildFakeWallet({
      refreshVtxos: jest.fn().mockReturnValue(new Promise(() => {}))
    })
    await openWallet('ref6', wallet)
    const pending = provider.refreshVtxos('ref6', ['vtxo1'])
    __emitWalletNotification(movementCreatedEvent('refresh', 'bark.round'))
    await expect(pending).resolves.toBe('pending')
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('refreshVtxos ignores movement notifications of other subsystems', async () => {
    const wallet = buildFakeWallet({
      refreshVtxos: jest.fn().mockResolvedValue('txid-late')
    })
    await openWallet('ref3', wallet)
    const pending = provider.refreshVtxos('ref3', ['vtxo1'])
    __emitWalletNotification(movementCreatedEvent('arkoor', 'bark.send'))
    await expect(pending).resolves.toBe('txid-late')
  })

  it('refreshVtxos rejects when the wallet operation fails first', async () => {
    const wallet = buildFakeWallet({
      refreshVtxos: jest.fn().mockRejectedValue(new Error('round failed'))
    })
    await openWallet('ref4', wallet)
    await expect(provider.refreshVtxos('ref4', ['vtxo1'])).rejects.toThrow(
      'round failed'
    )
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('refreshVtxos maps an undefined txid to an empty string', async () => {
    const wallet = buildFakeWallet({
      refreshVtxos: jest.fn().mockResolvedValue(undefined)
    })
    await openWallet('ref5', wallet)
    await expect(provider.refreshVtxos('ref5', ['vtxo1'])).resolves.toBe('')
  })

  it('sendOnchain resolves with the offboard txid', async () => {
    const wallet = buildFakeWallet({
      sendOnchain: jest
        .fn()
        .mockResolvedValue({ movementId: 7, txid: 'offboard-txid' })
    })
    await openWallet('onchain1', wallet)
    await expect(
      provider.sendOnchain('onchain1', 'tb1qdest', 1000)
    ).resolves.toBe('offboard-txid')
    expect(__countWalletNotificationListeners()).toBe(0)
  })

  it('sendOnchain rejects after the timeout when nothing settles', async () => {
    jest.useFakeTimers()
    const wallet = buildFakeWallet({
      sendOnchain: jest.fn().mockReturnValue(new Promise(() => {}))
    })
    await openWallet('timeout1', wallet)
    const pending = provider.sendOnchain('timeout1', 'tb1qdest', 1000)
    await Promise.all([
      expect(pending).rejects.toThrow('no movement created within timeout'),
      jest.advanceTimersByTimeAsync(30_001)
    ])
    expect(__countWalletNotificationListeners()).toBe(0)
    jest.useRealTimers()
  })

  it('sendOnchain refuses a second send while the first is still running', async () => {
    const firstSend = createDeferred<{ movementId: number; txid: string }>()
    const wallet = buildFakeWallet({
      sendOnchain: jest
        .fn()
        .mockReturnValueOnce(firstSend.promise)
        .mockResolvedValue({ movementId: 8, txid: 'second-txid' })
    })
    await openWallet('sendBusy1', wallet)
    const first = provider.sendOnchain('sendBusy1', 'tb1qdest', 1000)

    await expect(
      provider.sendOnchain('sendBusy1', 'tb1qdest', 1000)
    ).rejects.toBeInstanceOf(ArkOperationBusyError)
    expect(wallet.sendOnchain).toHaveBeenCalledTimes(1)

    firstSend.resolve({ movementId: 7, txid: 'first-txid' })
    await expect(first).resolves.toBe('first-txid')
    await expect(
      provider.sendOnchain('sendBusy1', 'tb1qdest', 1000)
    ).resolves.toBe('second-txid')
  })

  it('a finishing refresh keeps the guard of another one that timed out', async () => {
    jest.useFakeTimers()
    const firstRefresh = createDeferred<string>()
    const secondRefresh = createDeferred<string>()
    const wallet = buildFakeWallet({
      refreshVtxos: jest
        .fn()
        .mockReturnValueOnce(firstRefresh.promise)
        .mockReturnValueOnce(secondRefresh.promise)
    })
    await openWallet('refGuard1', wallet)
    const timedOut = provider.refreshVtxos('refGuard1', ['vtxo1'])
    await jest.advanceTimersByTimeAsync(10_000)
    const finishing = provider.refreshVtxos('refGuard1', ['vtxo2'])
    await Promise.all([
      expect(timedOut).rejects.toThrow('no movement created within timeout'),
      jest.advanceTimersByTimeAsync(20_001)
    ])
    secondRefresh.resolve('second-txid')
    await expect(finishing).resolves.toBe('second-txid')
    jest.useRealTimers()

    await expect(
      provider.refreshVtxos('refGuard1', ['vtxo3'])
    ).rejects.toBeInstanceOf(ArkOperationBusyError)

    firstRefresh.resolve('first-txid')
    await firstRefresh.promise
  })

  it('sendOnchain refuses a retry while a timed-out send still runs', async () => {
    jest.useFakeTimers()
    const firstSend = createDeferred<{ movementId: number; txid: string }>()
    const wallet = buildFakeWallet({
      sendOnchain: jest
        .fn()
        .mockReturnValueOnce(firstSend.promise)
        .mockResolvedValue({ movementId: 8, txid: 'second-txid' })
    })
    await openWallet('sendRetry1', wallet)
    const timedOut = provider.sendOnchain('sendRetry1', 'tb1qdest', 1000)
    await Promise.all([
      expect(timedOut).rejects.toThrow('no movement created within timeout'),
      jest.advanceTimersByTimeAsync(30_001)
    ])
    jest.useRealTimers()

    await expect(
      provider.sendOnchain('sendRetry1', 'tb1qdest', 1000)
    ).rejects.toThrow('still running')
    expect(wallet.sendOnchain).toHaveBeenCalledTimes(1)

    firstSend.resolve({ movementId: 7, txid: 'first-txid' })
    await firstSend.promise
    await Promise.resolve()
    await expect(
      provider.sendOnchain('sendRetry1', 'tb1qdest', 1000)
    ).resolves.toBe('second-txid')
  })

  describe('exits', () => {
    const TIP = 300

    function exitStatus(vtxoId: string, tag: string, inner = {}) {
      return { state: { inner: { tipHeight: TIP, ...inner }, tag }, vtxoId }
    }

    function exitTx(tag: string) {
      return { status: { tag } }
    }

    it('listExits maps every exit state and its progress', async () => {
      const wallet = buildFakeWallet({
        getVtxoById: jest.fn((id: string) =>
          id === 'gone'
            ? Promise.reject(new Error('not found'))
            : Promise.resolve({ amountSats: 5000n })
        ),
        listAllExits: jest.fn().mockResolvedValue([
          exitStatus('start', 'Start'),
          exitStatus('proc', 'Processing', {
            transactions: [
              exitTx('Confirmed'),
              exitTx('AwaitingCpfpBroadcast'),
              exitTx('AwaitingConfirmation')
            ]
          }),
          exitStatus('delta', 'AwaitingDelta', { claimableHeight: 320 }),
          exitStatus('ready', 'Claimable', {
            claimableSince: { height: 310 }
          }),
          exitStatus('claiming', 'ClaimInProgress', { claimTxid: 'c1' }),
          exitStatus('gone', 'Claimed', { txid: 'c2' }),
          exitStatus('spent', 'VtxoAlreadySpent'),
          exitStatus('swept', 'VtxoSwept'),
          exitStatus('cancel', 'Canceled')
        ])
      })
      await openWallet('exits1', wallet)

      const exits = await provider.listExits('exits1')

      expect(wallet.listAllExits).toHaveBeenCalledWith(false, false)
      expect(exits.map((exit) => exit.status)).toStrictEqual([
        'starting',
        'processing',
        'awaitingDelta',
        'claimable',
        'claimInProgress',
        'claimed',
        'alreadySpent',
        'swept',
        'canceled'
      ])
      expect(exits[1]).toMatchObject({
        amountSats: 5000,
        awaitingCpfpBroadcast: true,
        confirmedTxCount: 1,
        tipHeight: TIP,
        totalTxCount: 3
      })
      expect(exits[2].claimableAtHeight).toBe(320)
      expect(exits[3].claimableAtHeight).toBe(310)
      expect(exits[4].claimTxid).toBe('c1')
      expect(exits[5]).toMatchObject({
        amountSats: undefined,
        claimTxid: 'c2',
        vtxoId: 'gone'
      })
    })

    it('estimateEmergencyExitFee converts bigint fees', async () => {
      const wallet = buildFakeWallet({
        estimateEmergencyExitFee: jest.fn().mockResolvedValue({
          claimFeeSats: 200n,
          exitBroadcastFeeSats: 1000n,
          feeRateSatPerVb: 3n,
          totalFeeSats: 1200n
        })
      })
      await openWallet('exitFee1', wallet)

      await expect(
        provider.estimateEmergencyExitFee('exitFee1', ['v1'])
      ).resolves.toStrictEqual({
        claimFeeSats: 200,
        exitBroadcastFeeSats: 1000,
        feeRateSatPerVb: 3,
        totalFeeSats: 1200
      })
      expect(wallet.estimateEmergencyExitFee).toHaveBeenCalledWith(
        ['v1'],
        undefined,
        undefined,
        undefined
      )
    })

    it('buildExitClaim drains only the given exits to the address', async () => {
      const wallet = buildFakeWallet({
        drainExits: jest.fn().mockResolvedValue({
          feeSats: 150n,
          psbtBase64: 'cHNidP8=',
          skippedVtxoIds: ['v2'],
          vtxoIds: ['v1']
        })
      })
      await openWallet('exitClaim1', wallet)

      await expect(
        provider.buildExitClaim('exitClaim1', ['v1', 'v2'], 'tb1qdest', 2)
      ).resolves.toStrictEqual({
        feeSats: 150,
        psbtBase64: 'cHNidP8=',
        skippedVtxoIds: ['v2'],
        vtxoIds: ['v1']
      })
      expect(wallet.drainExits).toHaveBeenCalledWith(
        ['v1', 'v2'],
        false,
        'tb1qdest',
        2n
      )
    })

    it('buildExitClaim refuses an empty selection', async () => {
      const wallet = buildFakeWallet({ drainExits: jest.fn() })
      await openWallet('exitClaim2', wallet)

      await expect(
        provider.buildExitClaim('exitClaim2', [], 'tb1qdest', 2)
      ).rejects.toThrow('No exits selected for claim')
      expect(wallet.drainExits).not.toHaveBeenCalled()
    })

    it('signExitClaim extracts the signed transaction', async () => {
      const wallet = buildFakeWallet({
        signExitClaimInputs: jest.fn().mockResolvedValue('signed-psbt')
      })
      extractTxFromPsbt.mockReturnValue('signed-hex')
      await openWallet('exitSign1', wallet)

      await expect(
        provider.signExitClaim('exitSign1', 'unsigned-psbt')
      ).resolves.toBe('signed-hex')
      expect(wallet.signExitClaimInputs).toHaveBeenCalledWith('unsigned-psbt')
      expect(extractTxFromPsbt).toHaveBeenCalledWith('signed-psbt')
    })

    it('fetchOnchainFeeRates converts every speed to sat/vB', async () => {
      await openWalletWithOnchainFeeRate('exitRates1', 2000n)

      await expect(
        provider.fetchOnchainFeeRates('exitRates1')
      ).resolves.toStrictEqual({
        fastSatPerVb: 16,
        regularSatPerVb: 8,
        slowSatPerVb: 4
      })
    })
  })
})
