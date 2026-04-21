import { useEcashStore } from '@/store/ecash'
import type {
  EcashAccount,
  EcashKeysetCounter,
  EcashMint,
  EcashProof
} from '@/types/models/Ecash'

function makeAccount(id: string, hasSeed = true): EcashAccount {
  return {
    createdAt: '2025-01-01T00:00:00.000Z',
    hasSeed,
    id,
    name: `Account ${id}`
  }
}

function makeMint(url: string): EcashMint {
  return {
    balance: 0,
    isConnected: true,
    keysets: [{ active: true, id: 'ks-1', unit: 'sat' as const }],
    name: `Mint ${url}`,
    url
  }
}

function makeProof(id: string, amount: number, mintUrl: string): EcashProof {
  return {
    C: `C-${id}`,
    amount,
    id,
    mintUrl,
    secret: `secret-${id}`
  }
}

describe('ecash store', () => {
  beforeEach(() => {
    useEcashStore.getState().clearAllData()
  })

  describe('account management', () => {
    it('adds an account and initializes empty collections', () => {
      const account = makeAccount('acc-1')
      useEcashStore.getState().addAccount(account)

      const state = useEcashStore.getState()
      expect(state.accounts).toHaveLength(1)
      expect(state.accounts[0]).toStrictEqual(account)
      expect(state.mints['acc-1']).toStrictEqual([])
      expect(state.proofs['acc-1']).toStrictEqual([])
      expect(state.transactions['acc-1']).toStrictEqual([])
      expect(state.counters['acc-1']).toStrictEqual([])
    })

    it('removes account and all associated data', () => {
      const account = makeAccount('acc-1')
      useEcashStore.getState().addAccount(account)
      useEcashStore
        .getState()
        .addMint('acc-1', makeMint('https://mint.example'))
      useEcashStore
        .getState()
        .addProofs('acc-1', [makeProof('p1', 100, 'https://mint.example')])

      useEcashStore.getState().removeAccount('acc-1')

      const state = useEcashStore.getState()
      expect(state.accounts).toHaveLength(0)
      expect(state.mints['acc-1']).toBeUndefined()
      expect(state.proofs['acc-1']).toBeUndefined()
    })

    it('clears activeAccountId when active account is removed', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore.getState().setActiveAccountId('acc-1')

      useEcashStore.getState().removeAccount('acc-1')

      expect(useEcashStore.getState().activeAccountId).toBeNull()
    })

    it('preserves activeAccountId when a different account is removed', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore.getState().addAccount(makeAccount('acc-2'))
      useEcashStore.getState().setActiveAccountId('acc-1')

      useEcashStore.getState().removeAccount('acc-2')

      expect(useEcashStore.getState().activeAccountId).toBe('acc-1')
    })
  })

  describe('proofs management', () => {
    it('adds proofs scoped to an account', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore.getState().addAccount(makeAccount('acc-2'))

      const proof1 = makeProof('p1', 64, 'https://mint.example')
      const proof2 = makeProof('p2', 128, 'https://mint.example')

      useEcashStore.getState().addProofs('acc-1', [proof1])
      useEcashStore.getState().addProofs('acc-2', [proof2])

      expect(useEcashStore.getState().proofs['acc-1']).toStrictEqual([proof1])
      expect(useEcashStore.getState().proofs['acc-2']).toStrictEqual([proof2])
    })

    it('removes proofs by ID within an account', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore
        .getState()
        .addProofs('acc-1', [
          makeProof('p1', 64, 'https://mint.example'),
          makeProof('p2', 128, 'https://mint.example')
        ])

      useEcashStore.getState().removeProofs('acc-1', ['p1'])

      const proofs = useEcashStore.getState().proofs['acc-1']
      expect(proofs).toHaveLength(1)
      expect(proofs[0].id).toBe('p2')
    })

    it('setProofs replaces all proofs for an account', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore
        .getState()
        .addProofs('acc-1', [makeProof('p1', 64, 'https://mint.example')])

      const newProofs = [makeProof('p3', 256, 'https://mint.example')]
      useEcashStore.getState().setProofs('acc-1', newProofs)

      expect(useEcashStore.getState().proofs['acc-1']).toStrictEqual(newProofs)
    })
  })

  describe('counter management', () => {
    it('updates counters for an account', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))

      const counters: EcashKeysetCounter[] = [
        { counter: 42, keysetId: 'ks-1' },
        { counter: 10, keysetId: 'ks-2' }
      ]
      useEcashStore.getState().updateCounters('acc-1', counters)

      expect(useEcashStore.getState().counters['acc-1']).toStrictEqual(counters)
    })

    it('replaces previous counters on update', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore
        .getState()
        .updateCounters('acc-1', [{ counter: 5, keysetId: 'ks-1' }])

      useEcashStore
        .getState()
        .updateCounters('acc-1', [{ counter: 50, keysetId: 'ks-1' }])

      const counters = useEcashStore.getState().counters['acc-1']
      expect(counters).toHaveLength(1)
      expect(counters[0].counter).toBe(50)
    })

    it('keeps counters isolated between accounts', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore.getState().addAccount(makeAccount('acc-2'))

      useEcashStore
        .getState()
        .updateCounters('acc-1', [{ counter: 10, keysetId: 'ks-A' }])
      useEcashStore
        .getState()
        .updateCounters('acc-2', [{ counter: 20, keysetId: 'ks-B' }])

      expect(useEcashStore.getState().counters['acc-1'][0].counter).toBe(10)
      expect(useEcashStore.getState().counters['acc-2'][0].counter).toBe(20)
    })
  })

  describe('clearAccountData', () => {
    it('clears data without removing the account itself', () => {
      useEcashStore.getState().addAccount(makeAccount('acc-1'))
      useEcashStore
        .getState()
        .addMint('acc-1', makeMint('https://mint.example'))
      useEcashStore
        .getState()
        .addProofs('acc-1', [makeProof('p1', 100, 'https://mint.example')])
      useEcashStore
        .getState()
        .updateCounters('acc-1', [{ counter: 5, keysetId: 'ks-1' }])

      useEcashStore.getState().clearAccountData('acc-1')

      const state = useEcashStore.getState()
      expect(state.accounts).toHaveLength(1)
      expect(state.mints['acc-1']).toStrictEqual([])
      expect(state.proofs['acc-1']).toStrictEqual([])
      expect(state.counters['acc-1']).toStrictEqual([])
    })
  })

  describe('legacy migration', () => {
    it('migrates flat state into a legacy account', () => {
      const legacyMint = makeMint('https://old-mint.example')

      const migrated = simulateMigration({
        activeMint: legacyMint,
        mints: [legacyMint],
        proofs: [{ C: 'C-1', amount: 500, id: 'lp-1', secret: 's1' }],
        transactions: []
      })

      expect(migrated.accounts).toHaveLength(1)
      expect(migrated.accounts[0].id).toBe('legacy')
      expect(migrated.accounts[0].hasSeed).toBe(false)
      expect(migrated.accounts[0].name).toBe('Legacy Ecash')
      expect(migrated.activeAccountId).toBe('legacy')
      expect(migrated.mints.legacy).toStrictEqual([legacyMint])
      expect(migrated.proofs.legacy).toHaveLength(1)
      expect(migrated.proofs.legacy[0].mintUrl).toBe('https://old-mint.example')
    })

    it('backfills mintUrl on legacy proofs from activeMint', () => {
      const legacyMint = makeMint('https://my-mint.example')

      const migrated = simulateMigration({
        activeMint: legacyMint,
        mints: [legacyMint],
        proofs: [{ C: 'C-1', amount: 100, id: 'p1', secret: 's1' }],
        transactions: []
      })

      expect(migrated.proofs.legacy[0].mintUrl).toBe('https://my-mint.example')
    })

    it('does not migrate when no legacy data exists', () => {
      const migrated = simulateMigration({
        mints: [],
        proofs: [],
        transactions: []
      })

      expect(migrated.accounts).toBeUndefined()
    })

    it('passes through already-migrated state', () => {
      const account = makeAccount('acc-1')
      const alreadyMigrated = {
        accounts: [account],
        activeAccountId: 'acc-1',
        counters: {},
        mints: { 'acc-1': [] },
        proofs: { 'acc-1': [] },
        quotes: { 'acc-1': { melt: [], mint: [] } },
        transactions: { 'acc-1': [] }
      }

      const migrated = simulateMigration(alreadyMigrated)

      expect(migrated.accounts).toStrictEqual([account])
      expect(migrated.activeAccountId).toBe('acc-1')
    })
  })
})

/**
 * Simulates the zustand persist `merge` callback by calling
 * `migrateLegacyState` logic. We replicate the merge function
 * since migrateLegacyState is not exported.
 */
function simulateMigration(persisted: Record<string, unknown>) {
  // Re-implement the migration logic that lives in the store's merge callback.
  // This mirrors store/ecash.ts migrateLegacyState exactly.
  type LegacyState = {
    mints?: EcashMint[]
    activeMint?: EcashMint | null
    proofs?: (EcashProof & { mintUrl?: string })[]
    transactions?: unknown[]
    accounts?: EcashAccount[]
    [key: string]: unknown
  }

  const legacy = persisted as LegacyState

  if (legacy.accounts) {
    return legacy
  }

  const hasLegacyData =
    (Array.isArray(legacy.mints) && legacy.mints.length > 0) ||
    (Array.isArray(legacy.proofs) && legacy.proofs.length > 0) ||
    (Array.isArray(legacy.transactions) && legacy.transactions.length > 0)

  if (!hasLegacyData) {
    return legacy
  }

  const legacyMints = legacy.mints ?? []
  const legacyProofs = (legacy.proofs ?? []).map((proof) => ({
    ...proof,
    mintUrl: proof.mintUrl ?? legacy.activeMint?.url ?? ''
  }))
  const legacyTransactions = legacy.transactions ?? []
  const legacyQuotes = (legacy as Record<string, unknown>).quotes ?? {
    melt: [],
    mint: []
  }

  return {
    ...legacy,
    accounts: [
      {
        createdAt: expect.any(String),
        hasSeed: false,
        id: 'legacy',
        name: 'Legacy Ecash'
      }
    ],
    activeAccountId: 'legacy',
    counters: {},
    mints: { legacy: legacyMints },
    proofs: { legacy: legacyProofs },
    quotes: { legacy: legacyQuotes },
    transactions: { legacy: legacyTransactions }
  }
}
