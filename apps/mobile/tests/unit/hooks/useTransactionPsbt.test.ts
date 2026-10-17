import * as bitcoinjs from 'bitcoinjs-lib'
import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { buildPsbt, buildTransaction } from '@/api/bdk'
import { useTransactionPsbt } from '@/hooks/useTransactionPsbt'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { createMockPsbt } from '@/utils/psbt'

jest.mock<Partial<typeof import('@/api/bdk')>>('@/api/bdk', () => ({
  buildPsbt: jest.fn(),
  buildTransaction: jest.fn()
}))

const mockUseWallet = jest.fn()
jest.mock<typeof import('@/hooks/useGetAccountWallet')>(
  '@/hooks/useGetAccountWallet',
  () => ({
    __esModule: true,
    default: () => mockUseWallet()
  })
)

const mockBuildPsbt = jest.mocked(buildPsbt)
const mockBuildTransaction = jest.mocked(buildTransaction)

const ADDRESS = bitcoinjs.payments.p2wpkh({
  pubkey: Buffer.from(
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    'hex'
  )
}).address

function routePsbtBase64() {
  const psbt = new bitcoinjs.Psbt()
  psbt.addInput({ hash: Buffer.alloc(32, 0x11), index: 0 })
  psbt.addOutput({ address: ADDRESS ?? '', value: 90_000 })
  return psbt.toBase64()
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    displayIndex: 0,
    id: 'acc-1',
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: 'Test',
    network: 'bitcoin',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    },
    policyType: 'singlesig',
    summary: {
      balance: 0,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: [],
    ...overrides
  }
}

function fillBuilder() {
  const store = useTransactionBuilderStore.getState()
  store.addInput({
    addressTo: ADDRESS,
    keychain: 'external',
    label: '',
    txid: 'aa'.repeat(32),
    value: 100_000,
    vout: 0
  })
  store.addOutput({ amount: 90_000, label: '', to: ADDRESS ?? '' })
}

const mounted: ReactTestRenderer[] = []

type TransactionPsbt = ReturnType<typeof useTransactionPsbt>
type HarnessProps = {
  account: Account | undefined
  routePsbt: string | undefined
}

async function renderTransactionPsbt(props: HarnessProps) {
  const onNotice = jest.fn()
  const hook: { current: TransactionPsbt | null } = { current: null }
  function Harness({ account, routePsbt }: HarnessProps) {
    hook.current = useTransactionPsbt({
      account,
      accountId: 'acc-1',
      onNotice,
      routePsbt
    })
    return null
  }
  await act(async () => {
    mounted.push(create(createElement(Harness, props)))
  })
  const renderer = mounted.at(-1)
  async function rerender(nextProps: HarnessProps) {
    await act(async () => {
      renderer?.update(createElement(Harness, nextProps))
    })
  }
  return { hook, onNotice, rerender }
}

describe('useTransactionPsbt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useTransactionBuilderStore.getState().clearTransaction()
    mockUseWallet.mockReturnValue({ wallet: 'stub' })
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mounted.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it('builds the preview PSBT from the builder state', async () => {
    fillBuilder()
    const built = createMockPsbt(routePsbtBase64(), 'built-txid', 1000)
    mockBuildTransaction.mockResolvedValue(built)

    const { hook } = await renderTransactionPsbt({
      account: undefined,
      routePsbt: undefined
    })

    expect(mockBuildTransaction).toHaveBeenCalledTimes(1)
    expect(mockBuildPsbt).not.toHaveBeenCalled()
    expect(hook.current?.psbtBuildStatus).toBe('idle')
    expect(hook.current?.transactionId).toBe('built-txid')
    expect(useTransactionBuilderStore.getState().psbt).toBe(built)
    expect(hook.current?.serializedPsbt).toBe(
      Buffer.from(routePsbtBase64(), 'base64').toString('hex')
    )
  })

  it('fails the build when the account has no wallet', async () => {
    fillBuilder()
    mockUseWallet.mockReturnValue(undefined)

    const { hook, onNotice } = await renderTransactionPsbt({
      account: undefined,
      routePsbt: undefined
    })

    expect(hook.current?.psbtBuildStatus).toBe('error')
    expect(hook.current?.psbtBuildError).toStrictEqual({
      key: 'transaction.error.previewMissingWallet'
    })
    expect(onNotice).toHaveBeenCalledWith({
      key: 'error.notFound.wallet',
      type: 'error'
    })
  })

  it('fails the build when there are no inputs', async () => {
    const { hook } = await renderTransactionPsbt({
      account: undefined,
      routePsbt: undefined
    })

    expect(hook.current?.psbtBuildError).toStrictEqual({
      key: 'transaction.error.previewMissingInputs'
    })
    expect(mockBuildTransaction).not.toHaveBeenCalled()
  })

  it('flags a dust output without a toast', async () => {
    fillBuilder()
    mockBuildTransaction.mockRejectedValue(
      new Error('Output below the dust limit')
    )

    const { hook, onNotice } = await renderTransactionPsbt({
      account: undefined,
      routePsbt: undefined
    })

    expect(hook.current?.isDustError).toBe(true)
    expect(hook.current?.psbtBuildError).toStrictEqual({
      key: 'transaction.error.previewBuildFailedDust'
    })
    expect(onNotice).not.toHaveBeenCalled()
  })

  it("reports other build errors with the library's message", async () => {
    fillBuilder()
    mockBuildTransaction.mockRejectedValue(new Error('Insufficient funds'))

    const { hook, onNotice } = await renderTransactionPsbt({
      account: undefined,
      routePsbt: undefined
    })

    expect(hook.current?.isDustError).toBe(false)
    expect(onNotice).toHaveBeenCalledWith({
      text: 'Insufficient funds',
      type: 'error'
    })
  })

  it('imports the route PSBT instead of building one', async () => {
    const routePsbt = routePsbtBase64()

    const { hook, onNotice } = await renderTransactionPsbt({
      account: undefined,
      routePsbt
    })

    expect(mockBuildTransaction).not.toHaveBeenCalled()
    expect(useTransactionBuilderStore.getState().psbt?.toBase64()).toBe(
      routePsbt
    )
    expect(hook.current?.transactionId).not.toBe('')
    expect(hook.current?.isLoadingPSBT).toBe(false)
    expect(onNotice).toHaveBeenCalledWith({
      key: 'transaction.preview.psbtLoadedLimited',
      type: 'info'
    })
  })

  it('re-imports the route PSBT only when the account id changes', async () => {
    const routePsbt = routePsbtBase64()
    const { rerender } = await renderTransactionPsbt({
      account: makeAccount(),
      routePsbt
    })
    expect(useTransactionBuilderStore.getState().psbt?.toBase64()).toBe(
      routePsbt
    )
    // A re-import clears the signed transaction.
    act(() => {
      useTransactionBuilderStore.getState().setSignedTx('signed-hex')
    })

    await rerender({ account: makeAccount({ name: 'Renamed' }), routePsbt })
    expect(useTransactionBuilderStore.getState().signedTx).toBe('signed-hex')

    await rerender({ account: makeAccount({ id: 'acc-2' }), routePsbt })
    expect(useTransactionBuilderStore.getState().signedTx).toBeFalsy()
  })
})
