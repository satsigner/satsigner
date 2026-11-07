import { listArkExits, syncArkExits } from '@/api/ark'
import { refreshArkExits } from '@/services/arkExitClaim'
import {
  findNewlyClaimableArkExits,
  markArkExitsAnnounced
} from '@/services/arkExitWatch'
import { useArkStore } from '@/store/ark'
import { useArkExitClaimsStore } from '@/store/arkExitClaims'
import { type ArkExit } from '@/types/models/Ark'

jest.mock<typeof import('@/api/ark')>('@/api/ark', () => ({
  listArkExits: jest.fn(),
  syncArkExits: jest.fn()
}))
jest.mock<typeof import('@/services/arkWallet')>(
  '@/services/arkWallet',
  () => ({
    ensureArkWalletOpen: jest.fn()
  })
)

const ARK_ACCOUNT_ID = 'ark-1'

function exit(vtxoId: string, status: ArkExit['status']): ArkExit {
  return { amountSats: 10_000, status, tipHeight: 1000, vtxoId }
}

describe('findNewlyClaimableArkExits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useArkStore.getState().clearAllData()
    useArkStore.getState().addAccount({
      bitcoinAccountId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: ARK_ACCOUNT_ID,
      name: 'Ark',
      network: 'signet',
      serverId: 'second'
    })
    useArkStore.getState().updateBalance(ARK_ACCOUNT_ID, {
      claimableLightningReceiveSats: 0,
      pendingBoardSats: 0,
      pendingExitSats: 20_000,
      pendingInRoundSats: 0,
      pendingLightningSendSats: 0,
      spendableSats: 0
    })
    useArkExitClaimsStore.getState().clearAllData()
    jest.mocked(syncArkExits).mockResolvedValue()
    jest
      .mocked(listArkExits)
      .mockResolvedValue([exit('a:0', 'claimable'), exit('b:0', 'processing')])
  })

  async function announce() {
    const notices = await findNewlyClaimableArkExits()
    for (const notice of notices) {
      markArkExitsAnnounced(notice)
    }
    return notices
  }

  it('announces claimable exits once', async () => {
    await expect(announce()).resolves.toStrictEqual([
      {
        accountId: ARK_ACCOUNT_ID,
        accountName: 'Ark',
        claimableIds: ['a:0'],
        count: 1
      }
    ])
    await expect(announce()).resolves.toStrictEqual([])
  })

  it('announces again when the notice was never shown', async () => {
    await findNewlyClaimableArkExits()

    await expect(findNewlyClaimableArkExits()).resolves.toHaveLength(1)
  })

  it('still announces exits a screen refresh saw first', async () => {
    await refreshArkExits(ARK_ACCOUNT_ID)

    await expect(announce()).resolves.toHaveLength(1)
  })

  it('announces only the exits that became claimable since', async () => {
    await announce()
    jest
      .mocked(listArkExits)
      .mockResolvedValue([exit('a:0', 'claimable'), exit('b:0', 'claimable')])

    await expect(announce()).resolves.toStrictEqual([
      {
        accountId: ARK_ACCOUNT_ID,
        accountName: 'Ark',
        claimableIds: ['a:0', 'b:0'],
        count: 1
      }
    ])
  })

  it('announces an exit again after it stopped being claimable', async () => {
    await announce()
    jest.mocked(listArkExits).mockResolvedValue([exit('a:0', 'processing')])
    await announce()
    jest.mocked(listArkExits).mockResolvedValue([exit('a:0', 'claimable')])

    await expect(announce()).resolves.toHaveLength(1)
  })
})
