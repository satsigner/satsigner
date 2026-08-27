import * as bitcoinjs from 'bitcoinjs-lib'
import { __resetPayjoinMock, createSenderSession } from 'react-native-payjoin'

import { boardArkPsbt } from '@/api/ark'
import {
  createReceivePayjoinSession,
  finalizeBoardReceiverPayjoin,
  pollReceiverSession,
  type FetchLike
} from '@/api/payjoin'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { type PayjoinWalletCallbacks } from '@/types/payjoin'

jest.mock<typeof import('@/api/ark')>('@/api/ark', () => ({
  boardArkPsbt: jest.fn()
}))

const boardArkPsbtMock = jest.mocked(boardArkPsbt)

const BOARD_ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const BOARD_DESTINATION = {
  expiryHeight: 900_000,
  keypairIndex: 3,
  serverId: 'second' as const
}
const PENDING_BOARD = {
  amountSats: 50_000,
  txid: 'txid-board',
  vtxoId: 'vtxo-board'
}

const TXID_A = 'aa'.repeat(32)
const boardScript = Buffer.from(`0014${'22'.repeat(20)}`, 'hex')
const changeScript = Buffer.from(`0014${'33'.repeat(20)}`, 'hex')

function buildOriginalPsbt(): string {
  const psbt = new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet })
  psbt.addInput({
    hash: TXID_A,
    index: 0,
    sequence: 0xfffffffd,
    witnessUtxo: {
      script: Buffer.from(`0014${'11'.repeat(20)}`, 'hex'),
      value: 100_000
    }
  })
  psbt.addOutput({ script: boardScript, value: 50_000 })
  psbt.addOutput({ script: changeScript, value: 49_000 })
  return psbt.toBase64()
}

const callbacks: PayjoinWalletCallbacks = {
  hasSeenInput: () => false,
  isScriptOwned: () => false,
  listCandidateOutpoints: () => [],
  markInputSeen: () => undefined,
  signPsbt: (psbt) => psbt
}

function trackingFetch(calls: string[]): FetchLike {
  return (url) => {
    calls.push(url)
    return Promise.resolve({ body: '', bytes: new Uint8Array(), status: 200 })
  }
}

async function createBoardSessionWithOriginal() {
  const session = await createReceivePayjoinSession({
    accountId: 'ark1',
    address: BOARD_ADDRESS,
    board: BOARD_DESTINATION
  })
  // A sender posting into the mailbox is what delivers the original PSBT.
  await createSenderSession({
    disableOutputSubstitution: true,
    originalPsbtBase64: buildOriginalPsbt(),
    pjUri: session.uri
  })
  const polled = await pollReceiverSession({
    callbacks,
    fetchImpl: trackingFetch([]),
    session
  })
  return polled.session
}

describe('payjoin ark boarding (zero-input receiver)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    __resetPayjoinMock()
    usePayjoinSessionsStore.getState().clearAll()
    boardArkPsbtMock.mockResolvedValue(PENDING_BOARD)
  })

  it('stores the board destination on the session', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'ark1',
      address: BOARD_ADDRESS,
      board: BOARD_DESTINATION
    })
    expect(session.status).toBe('ready')
    expect(session.board).toStrictEqual(BOARD_DESTINATION)
    const persisted = usePayjoinSessionsStore
      .getState()
      .getActiveReceiverSession('ark1')
    expect(persisted?.board).toStrictEqual(BOARD_DESTINATION)
  })

  it('cosigns the board before posting the proposal to the directory', async () => {
    const session = await createBoardSessionWithOriginal()
    expect(session.status).toBe('proposal_received')

    const order: string[] = []
    boardArkPsbtMock.mockImplementation(() => {
      order.push('boardPsbt')
      return Promise.resolve(PENDING_BOARD)
    })

    const finalized = await finalizeBoardReceiverPayjoin({
      fetchImpl: (url) => {
        order.push(`post:${url}`)
        return Promise.resolve({
          body: '',
          bytes: new Uint8Array(),
          status: 200
        })
      },
      session
    })

    expect(finalized.status).toBe('completed')
    expect(finalized.txid).toBe(PENDING_BOARD.txid)
    expect(finalized.error).toBeUndefined()
    expect(finalized.nativeState).toBeUndefined()
    expect(boardArkPsbtMock).toHaveBeenCalledWith(
      BOARD_DESTINATION.serverId,
      'ark1',
      finalized.proposalPsbtBase64,
      BOARD_DESTINATION.keypairIndex,
      BOARD_DESTINATION.expiryHeight
    )
    expect(order[0]).toBe('boardPsbt')
    expect(order[1]).toMatch(/^post:/)
  })

  it('does not post the proposal when the board cosign fails', async () => {
    const session = await createBoardSessionWithOriginal()
    boardArkPsbtMock.mockRejectedValue(new Error('server rejected board'))
    const postCalls: string[] = []

    await expect(
      finalizeBoardReceiverPayjoin({
        fetchImpl: trackingFetch(postCalls),
        session
      })
    ).rejects.toThrow('server rejected board')
    expect(postCalls).toHaveLength(0)
  })

  it('errors when the session has no board destination', async () => {
    const session = await createBoardSessionWithOriginal()
    const finalized = await finalizeBoardReceiverPayjoin({
      fetchImpl: trackingFetch([]),
      session: { ...session, board: undefined }
    })
    expect(finalized.status).toBe('error')
    expect(finalized.error).toBe('missing board destination')
    expect(boardArkPsbtMock).not.toHaveBeenCalled()
  })

  it('errors when finalize runs before a proposal arrives', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'ark1',
      address: BOARD_ADDRESS,
      board: BOARD_DESTINATION
    })
    const finalized = await finalizeBoardReceiverPayjoin({
      fetchImpl: trackingFetch([]),
      session
    })
    expect(finalized.status).toBe('error')
    expect(finalized.error).toBe('missing proposal state')
    expect(boardArkPsbtMock).not.toHaveBeenCalled()
  })
})
