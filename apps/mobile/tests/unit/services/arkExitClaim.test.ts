import * as bitcoinjs from 'bitcoinjs-lib'

import {
  buildArkExitClaim,
  listArkExits,
  signArkExitClaim,
  syncArkExits
} from '@/api/ark'
import { broadcastRawTransaction } from '@/api/broadcast'
import { t } from '@/locales'
import { reserveFreshReceiveAddress } from '@/services/accountReceiveAddress'
import {
  claimArkExits,
  discardArkExitClaim,
  retryArkExitClaimBroadcast
} from '@/services/arkExitClaim'
import mmkvStorage from '@/storage/mmkv'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useArkExitClaimsStore } from '@/store/arkExitClaims'
import { type Account } from '@/types/models/Account'
import { type ArkExit } from '@/types/models/Ark'

jest.mock<typeof import('@/api/ark')>('@/api/ark', () => ({
  buildArkExitClaim: jest.fn(),
  listArkExits: jest.fn(),
  signArkExitClaim: jest.fn(),
  syncArkExits: jest.fn()
}))
jest.mock<typeof import('@/api/broadcast')>('@/api/broadcast', () => ({
  broadcastRawTransaction: jest.fn()
}))
jest.mock<typeof import('@/services/accountReceiveAddress')>(
  '@/services/accountReceiveAddress',
  () => ({
    peekFreshReceiveAddress: jest.fn(),
    reserveFreshReceiveAddress: jest.fn()
  })
)
jest.mock<typeof import('@/services/arkWallet')>(
  '@/services/arkWallet',
  () => ({
    ensureArkWalletOpen: jest.fn()
  })
)

const ARK_ACCOUNT_ID = 'ark-1'
const DESTINATION_ID = 'wallet-1'
const NETWORK = bitcoinjs.networks.testnet
const EXIT_SCRIPT = Buffer.from(`5120${'55'.repeat(32)}`, 'hex')
const DESTINATION_SCRIPT = Buffer.from(`0014${'11'.repeat(20)}`, 'hex')
const DESTINATION = bitcoinjs.address.fromOutputScript(
  DESTINATION_SCRIPT,
  NETWORK
)
const EXIT_VALUE = 50_000n
const FEE_SATS = 300
const FEE_RATE = 3

const exitTx = new bitcoinjs.Transaction()
exitTx.addInput(Buffer.alloc(32, 7), 0)
exitTx.addOutput(EXIT_SCRIPT, EXIT_VALUE)
const VTXO_ID = `${exitTx.getId()}:0`

const claimPsbt = new bitcoinjs.Psbt({ network: NETWORK })
claimPsbt.addInput({
  hash: exitTx.getHash(),
  index: 0,
  witnessUtxo: { script: EXIT_SCRIPT, value: EXIT_VALUE }
})
claimPsbt.addOutput({
  script: DESTINATION_SCRIPT,
  value: EXIT_VALUE - BigInt(FEE_SATS)
})
const signedClaimTx = bitcoinjs.Transaction.fromBuffer(
  claimPsbt.data.globalMap.unsignedTx.toBuffer()
)
signedClaimTx.setWitness(0, [Buffer.alloc(64, 1)])
const SIGNED_HEX = signedClaimTx.toHex()
const CLAIM_TXID = signedClaimTx.getId()

const SUBMISSION = {
  approved: {
    amountSats: Number(EXIT_VALUE) - FEE_SATS,
    feeSats: FEE_SATS,
    vtxoIds: [VTXO_ID]
  },
  arkAccountId: ARK_ACCOUNT_ID,
  destinationAccountId: DESTINATION_ID,
  feeRateSatPerVb: FEE_RATE
}
const CLAIMS_STORAGE_KEY = 'satsigner-ark-exit-claims'

function claimableExit(): ArkExit {
  return {
    amountSats: Number(EXIT_VALUE),
    status: 'claimable',
    tipHeight: 1000,
    vtxoId: VTXO_ID
  }
}

function destinationAccount(): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    id: DESTINATION_ID,
    keyCount: 1,
    keys: [{ creationType: 'importExtendedPub', index: 0, iv: '', secret: '' }],
    keysRequired: 1,
    labels: {},
    name: 'Savings',
    network: 'signet',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(0),
      relays: [],
      syncStart: new Date(0),
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
    utxos: []
  }
}

function savedClaims() {
  return useArkExitClaimsStore.getState().claims
}

describe('claimArkExits', () => {
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
    useAccountsStore.setState({ accounts: [destinationAccount()] })
    useArkExitClaimsStore.getState().clearAllData()
    jest.mocked(syncArkExits).mockResolvedValue()
    jest.mocked(listArkExits).mockResolvedValue([claimableExit()])
    jest.mocked(reserveFreshReceiveAddress).mockResolvedValue(DESTINATION)
    jest.mocked(buildArkExitClaim).mockResolvedValue({
      feeSats: FEE_SATS,
      psbtBase64: claimPsbt.toBase64(),
      skippedVtxoIds: [],
      vtxoIds: [VTXO_ID]
    })
    jest.mocked(signArkExitClaim).mockResolvedValue(SIGNED_HEX)
    jest.mocked(broadcastRawTransaction).mockResolvedValue(CLAIM_TXID)
  })

  it('keeps the signed claim before broadcasting it', async () => {
    jest.mocked(broadcastRawTransaction).mockImplementation(() => {
      expect(savedClaims()).toMatchObject([
        { broadcastStatus: 'broadcasting', txHex: SIGNED_HEX }
      ])
      return Promise.resolve(CLAIM_TXID)
    })

    await expect(claimArkExits(SUBMISSION)).resolves.toStrictEqual({
      amountSats: Number(EXIT_VALUE) - FEE_SATS,
      destinationName: 'Savings',
      txid: CLAIM_TXID
    })
    expect(buildArkExitClaim).toHaveBeenCalledWith(
      'second',
      ARK_ACCOUNT_ID,
      [VTXO_ID],
      DESTINATION,
      FEE_RATE
    )
    expect(savedClaims()).toMatchObject([
      {
        broadcastStatus: 'broadcast',
        destinationAccountId: DESTINATION_ID,
        txid: CLAIM_TXID,
        vtxoIds: [VTXO_ID]
      }
    ])
  })

  it('refuses a second claim while the first still runs', async () => {
    const pending = claimArkExits(SUBMISSION)

    await expect(claimArkExits(SUBMISSION)).rejects.toThrow(
      t('ark.exit.claim.blocker.claimInProgress')
    )
    await pending
    expect(buildArkExitClaim).toHaveBeenCalledTimes(1)
  })

  it('refuses a new claim while a kept one waits to settle', async () => {
    await claimArkExits(SUBMISSION)

    await expect(claimArkExits(SUBMISSION)).rejects.toThrow(
      t('ark.exit.claim.blocker.claimInProgress')
    )
    expect(buildArkExitClaim).toHaveBeenCalledTimes(1)
  })

  it('never signs a claim that pays somewhere else', async () => {
    jest
      .mocked(reserveFreshReceiveAddress)
      .mockResolvedValue(
        bitcoinjs.address.fromOutputScript(
          Buffer.from(`0014${'22'.repeat(20)}`, 'hex'),
          NETWORK
        )
      )

    await expect(claimArkExits(SUBMISSION)).rejects.toThrow(
      t('ark.exit.claim.rejection.unexpectedOutputs')
    )
    expect(signArkExitClaim).not.toHaveBeenCalled()
    expect(broadcastRawTransaction).not.toHaveBeenCalled()
    expect(savedClaims()).toStrictEqual([])
  })

  it('refuses a fractional fee rate', async () => {
    await expect(
      claimArkExits({ ...SUBMISSION, feeRateSatPerVb: 1.5 })
    ).rejects.toThrow(t('ark.exit.claim.error.invalidFeeRate'))
    expect(buildArkExitClaim).not.toHaveBeenCalled()
  })

  it('keeps a failed broadcast so only the same claim is resent', async () => {
    jest
      .mocked(broadcastRawTransaction)
      .mockRejectedValueOnce(new Error('offline'))

    await expect(claimArkExits(SUBMISSION)).rejects.toThrow('offline')
    expect(savedClaims()).toMatchObject([{ broadcastStatus: 'failed' }])

    await retryArkExitClaimBroadcast(ARK_ACCOUNT_ID, CLAIM_TXID)

    expect(broadcastRawTransaction).toHaveBeenLastCalledWith(
      SIGNED_HEX,
      expect.anything(),
      'signet'
    )
    expect(savedClaims()).toMatchObject([{ broadcastStatus: 'broadcast' }])
    expect(buildArkExitClaim).toHaveBeenCalledTimes(1)
  })

  it('drops a kept claim once the wallet sees it spend the exits', async () => {
    await claimArkExits(SUBMISSION)
    jest
      .mocked(listArkExits)
      .mockResolvedValue([
        { ...claimableExit(), claimTxid: CLAIM_TXID, status: 'claimInProgress' }
      ])

    await retryArkExitClaimBroadcast(ARK_ACCOUNT_ID, CLAIM_TXID)

    expect(savedClaims()).toStrictEqual([])
    expect(broadcastRawTransaction).toHaveBeenCalledTimes(1)
  })

  it('discards only claims that failed to broadcast', async () => {
    await claimArkExits(SUBMISSION)

    await discardArkExitClaim(ARK_ACCOUNT_ID, CLAIM_TXID)
    expect(savedClaims()).toHaveLength(1)

    useArkExitClaimsStore
      .getState()
      .saveClaim({ ...savedClaims()[0], broadcastStatus: 'failed' })
    await discardArkExitClaim(ARK_ACCOUNT_ID, CLAIM_TXID)
    expect(savedClaims()).toStrictEqual([])
  })

  it('still blocks a new claim when a discarded one reached the network', async () => {
    jest
      .mocked(broadcastRawTransaction)
      .mockRejectedValueOnce(new Error('timeout'))
    await expect(claimArkExits(SUBMISSION)).rejects.toThrow('timeout')
    jest
      .mocked(listArkExits)
      .mockResolvedValue([
        { ...claimableExit(), claimTxid: CLAIM_TXID, status: 'claimInProgress' }
      ])

    await discardArkExitClaim(ARK_ACCOUNT_ID, CLAIM_TXID)

    expect(syncArkExits).toHaveBeenCalledTimes(2)
    await expect(claimArkExits(SUBMISSION)).rejects.toThrow(
      t('ark.exit.claim.blocker.claimInProgress')
    )
    expect(buildArkExitClaim).toHaveBeenCalledTimes(1)
  })

  it('refuses to sign a claim that changed since it was approved', async () => {
    await expect(
      claimArkExits({
        ...SUBMISSION,
        approved: { ...SUBMISSION.approved, feeSats: FEE_SATS - 100 }
      })
    ).rejects.toThrow(t('ark.exit.claim.error.changed'))
    expect(signArkExitClaim).not.toHaveBeenCalled()
    expect(savedClaims()).toStrictEqual([])
  })

  it('does not bring back a claim cleared while it was broadcast', async () => {
    jest.mocked(broadcastRawTransaction).mockImplementation(() => {
      useArkExitClaimsStore.getState().clearAllData()
      return Promise.resolve(CLAIM_TXID)
    })

    await claimArkExits(SUBMISSION)

    expect(savedClaims()).toStrictEqual([])
  })

  it('resends the kept claim after the app restarts', async () => {
    jest
      .mocked(broadcastRawTransaction)
      .mockRejectedValueOnce(new Error('offline'))
    await expect(claimArkExits(SUBMISSION)).rejects.toThrow('offline')
    const persisted = await mmkvStorage.getItem(CLAIMS_STORAGE_KEY)
    useArkExitClaimsStore.setState({ claims: [] })
    await mmkvStorage.setItem(CLAIMS_STORAGE_KEY, persisted ?? '')

    await useArkExitClaimsStore.persist.rehydrate()
    expect(savedClaims()).toMatchObject([{ broadcastStatus: 'failed' }])
    await retryArkExitClaimBroadcast(ARK_ACCOUNT_ID, CLAIM_TXID)

    expect(broadcastRawTransaction).toHaveBeenLastCalledWith(
      SIGNED_HEX,
      expect.anything(),
      'signet'
    )
    expect(buildArkExitClaim).toHaveBeenCalledTimes(1)
  })
})
