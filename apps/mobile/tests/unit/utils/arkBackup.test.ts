import type { ArkAccount } from '@/types/models/Ark'
import {
  collectArkBackup,
  prepareArkMnemonics,
  restoreArkDatadirsFromBackup,
  restoreArkLabelsFromBackup,
  restoreArkStoreFromBackup
} from '@/utils/arkBackup'

jest.mock<typeof import('@/db/mutations/arkLabels')>(
  '@/db/mutations/arkLabels',
  () => ({
    deleteArkLabelsByAccount: jest.fn(),
    setArkLabel: jest.fn()
  })
)

jest.mock<typeof import('@/db/queries/arkLabels')>(
  '@/db/queries/arkLabels',
  () => ({
    getArkLabelsByAccount: jest.fn()
  })
)

jest.mock<typeof import('@/storage/arkDatadir')>(
  '@/storage/arkDatadir',
  () => ({
    deleteArkDatadir: jest.fn(),
    writeArkDatadirFiles: jest.fn()
  })
)

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  getArkMnemonic: jest.fn()
}))

jest.mock<typeof import('@/store/ark')>('@/store/ark', () => ({
  useArkStore: { getState: jest.fn() }
}))

const ACCOUNT: ArkAccount = {
  bitcoinAccountId: 'btc-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'ark-1',
  name: 'Ark',
  network: 'signet',
  serverId: 'second'
}

const LABEL = {
  label: 'coffee',
  ref: 'movement:7',
  type: 'tx' as const
}

describe('prepareArkMnemonics', () => {
  it('returns an empty list when mnemonics are missing', () => {
    expect(prepareArkMnemonics(undefined)).toStrictEqual([])
  })

  it('drops null and empty mnemonics', () => {
    expect(
      prepareArkMnemonics({
        'ark-1': 'word word',
        'ark-2': null,
        'ark-3': ''
      })
    ).toStrictEqual([{ accountId: 'ark-1', mnemonic: 'word word' }])
  })
})

describe('collectArkBackup', () => {
  const addAccount = jest.fn()
  const clearAllData = jest.fn()
  const updateBalance = jest.fn()
  const updateStats = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    const { useArkStore } = jest.requireMock('@/store/ark') as {
      useArkStore: { getState: jest.Mock }
    }
    useArkStore.getState.mockReturnValue({
      accounts: [ACCOUNT],
      addAccount,
      balances: {
        'ark-1': {
          claimableLightningReceiveSats: 0,
          pendingBoardSats: 0,
          pendingExitSats: 0,
          pendingInRoundSats: 0,
          pendingLightningSendSats: 0,
          spendableSats: 100
        }
      },
      clearAllData,
      stats: {
        'ark-1': {
          numberOfAddresses: 1,
          numberOfRefreshes: 0,
          numberOfTransactions: 2,
          numberOfVtxos: 3
        }
      },
      updateBalance,
      updateStats
    })
    const { getArkLabelsByAccount } = jest.requireMock(
      '@/db/queries/arkLabels'
    ) as { getArkLabelsByAccount: jest.Mock }
    getArkLabelsByAccount.mockReturnValue({ 'movement:7': LABEL })
  })

  it('includes mnemonics, labels, and store cache without datadirs', async () => {
    const { getArkMnemonic } = jest.requireMock('@/storage/encrypted') as {
      getArkMnemonic: jest.Mock
    }
    getArkMnemonic.mockResolvedValue('seed words here')

    const backup = await collectArkBackup()

    expect(backup.accounts).toStrictEqual([ACCOUNT])
    expect(backup.mnemonics).toStrictEqual({ 'ark-1': 'seed words here' })
    expect(backup.labels).toStrictEqual({
      'ark-1': { 'movement:7': LABEL }
    })
    expect(backup.balances?.['ark-1']?.spendableSats).toBe(100)
    expect(backup.stats?.['ark-1']?.numberOfVtxos).toBe(3)
    expect(backup.datadirs).toBeUndefined()
  })

  it('keeps null mnemonics', async () => {
    const { getArkMnemonic } = jest.requireMock('@/storage/encrypted') as {
      getArkMnemonic: jest.Mock
    }
    getArkMnemonic.mockResolvedValue(null)

    const backup = await collectArkBackup()

    expect(backup.mnemonics).toStrictEqual({ 'ark-1': null })
    expect(backup.datadirs).toBeUndefined()
  })
})

describe('restoreArkStoreFromBackup', () => {
  const addAccount = jest.fn()
  const clearAllData = jest.fn()
  const updateBalance = jest.fn()
  const updateStats = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    const { useArkStore } = jest.requireMock('@/store/ark') as {
      useArkStore: { getState: jest.Mock }
    }
    useArkStore.getState.mockReturnValue({
      addAccount,
      clearAllData,
      updateBalance,
      updateStats
    })
  })

  it('clears and restores accounts, balances, and stats', () => {
    const balance = {
      claimableLightningReceiveSats: 0,
      pendingBoardSats: 0,
      pendingExitSats: 0,
      pendingInRoundSats: 0,
      pendingLightningSendSats: 0,
      spendableSats: 50
    }
    const stats = {
      numberOfAddresses: 1,
      numberOfRefreshes: 0,
      numberOfTransactions: 0,
      numberOfVtxos: 1
    }
    restoreArkStoreFromBackup({
      accounts: [ACCOUNT],
      balances: { 'ark-1': balance },
      stats: { 'ark-1': stats }
    })
    expect(clearAllData).toHaveBeenCalledTimes(1)
    expect(addAccount).toHaveBeenCalledWith(ACCOUNT)
    expect(updateBalance).toHaveBeenCalledWith('ark-1', balance)
    expect(updateStats).toHaveBeenCalledWith('ark-1', stats)
  })

  it('clears the store when ark data is missing (old backup without ark)', () => {
    restoreArkStoreFromBackup(undefined)
    expect(clearAllData).toHaveBeenCalledTimes(1)
    expect(addAccount).not.toHaveBeenCalled()
  })
})

describe('restoreArkLabelsFromBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes leftover and restored labels then writes restored labels', () => {
    const { deleteArkLabelsByAccount, setArkLabel } = jest.requireMock(
      '@/db/mutations/arkLabels'
    ) as {
      deleteArkLabelsByAccount: jest.Mock
      setArkLabel: jest.Mock
    }

    restoreArkLabelsFromBackup(
      { 'ark-1': { 'movement:7': LABEL } },
      ['old-ark'],
      ['ark-1']
    )

    expect(deleteArkLabelsByAccount).toHaveBeenCalledWith('old-ark')
    expect(deleteArkLabelsByAccount).toHaveBeenCalledWith('ark-1')
    expect(setArkLabel).toHaveBeenCalledWith(
      'ark-1',
      'movement:7',
      'tx',
      'coffee'
    )
  })

  it('does not require labels on a mnemonic-only payload', () => {
    const { setArkLabel } = jest.requireMock('@/db/mutations/arkLabels') as {
      setArkLabel: jest.Mock
    }
    restoreArkLabelsFromBackup(undefined, [], ['ark-1'])
    expect(setArkLabel).not.toHaveBeenCalled()
  })
})

describe('restoreArkDatadirsFromBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const { deleteArkDatadir, writeArkDatadirFiles } = jest.requireMock(
      '@/storage/arkDatadir'
    ) as {
      deleteArkDatadir: jest.Mock
      writeArkDatadirFiles: jest.Mock
    }
    deleteArkDatadir.mockResolvedValue(undefined)
    writeArkDatadirFiles.mockResolvedValue(undefined)
  })

  it('deletes leftover datadirs and writes restored files', async () => {
    const { deleteArkDatadir, writeArkDatadirFiles } = jest.requireMock(
      '@/storage/arkDatadir'
    ) as {
      deleteArkDatadir: jest.Mock
      writeArkDatadirFiles: jest.Mock
    }
    const files = [{ base64: 'ZGI=', filename: 'bark.db' }]

    await restoreArkDatadirsFromBackup(
      { 'ark-1': { files } },
      ['old-ark'],
      ['ark-1']
    )

    expect(deleteArkDatadir).toHaveBeenCalledWith('old-ark')
    expect(writeArkDatadirFiles).toHaveBeenCalledWith('ark-1', files)
  })

  it('writes an empty file list when a restored account has no datadir blob', async () => {
    const { writeArkDatadirFiles } = jest.requireMock(
      '@/storage/arkDatadir'
    ) as { writeArkDatadirFiles: jest.Mock }

    await restoreArkDatadirsFromBackup(undefined, [], ['ark-1'])

    expect(writeArkDatadirFiles).toHaveBeenCalledWith('ark-1', [])
  })
})
