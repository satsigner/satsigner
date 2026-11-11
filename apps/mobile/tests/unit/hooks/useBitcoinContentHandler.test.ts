import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { useBitcoinContentHandler } from '@/hooks/useBitcoinContentHandler'
import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type DetectedContent } from '@/utils/contentDetector'

const mockNavigate = jest.fn()
jest.mock<Partial<typeof import('expo-router')>>('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    canDismiss: jest.fn(),
    canGoBack: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
    navigate: mockNavigate,
    prefetch: jest.fn(),
    push: jest.fn(),
    reload: jest.fn(),
    replace: jest.fn(),
    setParams: jest.fn()
  })
}))
jest.mock<Partial<typeof import('@/hooks/useAccountKeyFingerprints')>>(
  '@/hooks/useAccountKeyFingerprints',
  () => ({ useAccountKeyFingerprintsLoader: () => jest.fn() })
)

const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

function makeAccount(balance: number): Account {
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
      balance,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: []
  }
}

function uriContent(uri: string): DetectedContent {
  return { cleaned: uri, isValid: true, raw: uri, type: 'bitcoin_uri' }
}

const mounted: ReactTestRenderer[] = []

type BitcoinContentHandler = ReturnType<typeof useBitcoinContentHandler>

function renderHandler(account: Account) {
  const onError = jest.fn()
  const onInfo = jest.fn()
  const onSuccess = jest.fn()
  const hook: { current: BitcoinContentHandler | null } = { current: null }
  function Harness() {
    hook.current = useBitcoinContentHandler({
      account,
      accountId: account.id,
      onError,
      onInfo,
      onSuccess
    })
    return null
  }
  act(() => {
    mounted.push(create(createElement(Harness)))
  })
  return { hook, onError, onSuccess }
}

describe('useBitcoinContentHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useTransactionBuilderStore.getState().clearTransaction()
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mounted.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it.each(['%ZZ', '50%25%20off', '%E0%A4%A'])(
    'sends to the uri address when the label is %s',
    async (label) => {
      const { hook, onError } = renderHandler(makeAccount(1_000_000))
      await act(async () => {
        await hook.current?.handleContentScanned(
          uriContent(`${ADDRESS}?amount=0.001&label=${label}`)
        )
      })
      const { outputs } = useTransactionBuilderStore.getState()
      expect(onError).not.toHaveBeenCalled()
      expect(outputs).toHaveLength(1)
      expect(outputs[0]).toMatchObject({ amount: 100_000, to: ADDRESS })
    }
  )

  describe('a payjoin uri asking for more than the balance', () => {
    const PAYJOIN_URI = `${ADDRESS}?amount=0.001&pj=https://payjo.in/mb`

    async function answerBalancePrompt(choice: 'cancel' | 'without_amount') {
      const { hook, onSuccess } = renderHandler(makeAccount(1000))
      const pendingScans: Promise<void>[] = []
      await act(async () => {
        const scan = hook.current?.handleContentScanned(uriContent(PAYJOIN_URI))
        if (scan) {
          pendingScans.push(scan)
        }
      })
      expect(hook.current?.uriExceedsBalanceModal).toMatchObject({
        requestedAmountSats: 100_000
      })
      await act(async () => {
        hook.current?.resolveUriExceedsBalancePrompt(choice)
        await Promise.all(pendingScans)
      })
      return { onSuccess }
    }

    it('says nothing about payjoin when the user cancels', async () => {
      const { onSuccess } = await answerBalancePrompt('cancel')
      const { outputs, payjoinUri } = useTransactionBuilderStore.getState()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(outputs).toHaveLength(0)
      expect(payjoinUri).toBeUndefined()
    })

    it('announces the payjoin when the user goes on without the amount', async () => {
      const { onSuccess } = await answerBalancePrompt('without_amount')
      expect(onSuccess).toHaveBeenCalledWith(
        t('transaction.build.payjoin.uriDetected')
      )
      expect(useTransactionBuilderStore.getState().payjoinUri).toBe(
        `bitcoin:${PAYJOIN_URI}`
      )
    })
  })
})
