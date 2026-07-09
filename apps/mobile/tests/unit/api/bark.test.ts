import * as barkModule from '@secondts/bark-react-native'

import '@/api/ark/providers/bark'
import { getArkProvider } from '@/api/ark/registry'
import type { ArkServer, ArkWalletProvider } from '@/types/models/Ark'

// jest.config.js maps @secondts/bark-react-native to the manual mock in
// __mocks__; these test-only helpers exist there, not in the real package.
type BarkTestHelpers = {
  __countWalletNotificationListeners: () => number
  __emitWalletNotification: (event: unknown) => void
  Wallet: { open: jest.Mock }
}

const { __countWalletNotificationListeners, __emitWalletNotification, Wallet } =
  barkModule as unknown as BarkTestHelpers

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
    allVtxos: jest.fn(),
    balance: jest.fn(),
    bolt11Invoice: jest.fn(),
    estimateArkoorPaymentFee: jest.fn(),
    history: jest.fn(),
    newAddress: jest.fn(),
    offboardVtxos: jest.fn(),
    payLightningInvoice: jest.fn(),
    peekAddress: jest.fn(),
    sendArkoorPayment: jest.fn(),
    sendOnchain: jest.fn(),
    spendableVtxos: jest.fn(),
    sync: jest.fn().mockResolvedValue(undefined),
    ...overrides
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

function movementCreatedEvent(subsystemKind: string) {
  return {
    inner: {
      movement: {
        effectiveBalanceSats: 0n,
        id: 1,
        status: 'pending',
        subsystemKind
      }
    },
    tag: 'MovementCreated'
  }
}

describe('bark provider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetchBalance converts bigint fields to numbers', async () => {
    const wallet = buildFakeWallet({
      balance: jest.fn().mockResolvedValue({
        claimableLightningReceiveSats: 1n,
        pendingBoardSats: 2n,
        pendingExitSats: 3n,
        pendingInRoundSats: 4n,
        pendingLightningSendSats: 5n,
        spendableSats: 21_000_000n
      })
    })
    await openWallet('bal1', wallet)
    await expect(provider.fetchBalance('bal1')).resolves.toStrictEqual({
      claimableLightningReceiveSats: 1,
      pendingBoardSats: 2,
      pendingExitSats: 3,
      pendingInRoundSats: 4,
      pendingLightningSendSats: 5,
      spendableSats: 21_000_000
    })
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

  it('listAllVtxos flags spendable vtxos from the spendable set', async () => {
    const wallet = buildFakeWallet({
      allVtxos: jest.fn().mockResolvedValue([
        { amountSats: 100n, expiryHeight: 10, id: 'a', kind: 'k', state: 's' },
        { amountSats: 200n, expiryHeight: 20, id: 'b', kind: 'k', state: 's' }
      ]),
      spendableVtxos: jest
        .fn()
        .mockResolvedValue([
          { amountSats: 100n, expiryHeight: 10, id: 'a', kind: 'k', state: 's' }
        ])
    })
    await openWallet('vtxo1', wallet)
    const vtxos = await provider.listAllVtxos('vtxo1')
    expect(vtxos.map((v) => [v.id, v.spendable, v.amountSats])).toStrictEqual([
      ['a', true, 100],
      ['b', false, 200]
    ])
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
      offboardVtxos: jest.fn().mockResolvedValue('txid-offboard')
    })
    await openWallet('off1', wallet)
    await expect(
      provider.offboardVtxos('off1', ['vtxo1'], 'tb1qdest')
    ).resolves.toBe('txid-offboard')
    expect(__countWalletNotificationListeners()).toBe(0)
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
      offboardVtxos: jest.fn().mockResolvedValue('txid-late')
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
})
