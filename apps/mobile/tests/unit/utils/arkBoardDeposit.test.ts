import { DUST_LIMIT } from '@/constants/btc'
import { t } from '@/locales'
import {
  isArkBoardPayjoinSend,
  matchingUnbroadcastBoardTxid,
  resolveArkBoardFundDestination,
  txidFromSignedDraft
} from '@/utils/arkBoardDeposit'

const ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const PAYJOIN_URI = `bitcoin:${ADDRESS}?pjos=0&pj=https://payjo.in/abc#EX1-600-OH1-mock-RK1-mock`
const PAYJOIN_WITH_AMOUNT = `bitcoin:${ADDRESS}?amount=0.0001&pjos=0&pj=https://payjo.in/abc#EX1-600-OH1-mock-RK1-mock`
const TXID = 'aa'.repeat(32)

describe('resolveArkBoardFundDestination', () => {
  it('uses dust as the send amount when the invoice has none', () => {
    expect(resolveArkBoardFundDestination(ADDRESS)).toStrictEqual({
      address: ADDRESS,
      amountSats: DUST_LIMIT
    })
  })

  it('prefers a caller amount such as min board over dust', () => {
    expect(resolveArkBoardFundDestination(ADDRESS, 10_000)).toStrictEqual({
      address: ADDRESS,
      amountSats: 10_000
    })
  })

  it('extracts address and payjoin URI from a BIP77 invoice', () => {
    expect(resolveArkBoardFundDestination(PAYJOIN_URI)).toStrictEqual({
      address: ADDRESS,
      amountSats: DUST_LIMIT,
      payjoinUri: PAYJOIN_URI
    })
  })

  it('uses the invoice amount when present', () => {
    expect(resolveArkBoardFundDestination(PAYJOIN_WITH_AMOUNT)).toStrictEqual({
      address: ADDRESS,
      amountSats: 10_000,
      payjoinUri: PAYJOIN_WITH_AMOUNT
    })
  })
})

describe('txidFromSignedDraft', () => {
  it('returns undefined for invalid hex', () => {
    expect(txidFromSignedDraft(undefined, 'not-hex')).toBeUndefined()
  })
})

describe('matchingUnbroadcastBoardTxid', () => {
  it('matches the active linked draft when it is signed and unbroadcast', () => {
    expect(
      matchingUnbroadcastBoardTxid({
        activeAccountId: 'btc-1',
        activeBroadcasted: false,
        activeTxid: TXID,
        linkedAccountId: 'btc-1',
        pendingTxids: [TXID],
        savedDraftTxid: undefined
      })
    ).toBe(TXID)
  })

  it('does not match after the linked draft was broadcast', () => {
    expect(
      matchingUnbroadcastBoardTxid({
        activeAccountId: 'btc-1',
        activeBroadcasted: true,
        activeTxid: TXID,
        linkedAccountId: 'btc-1',
        pendingTxids: [TXID],
        savedDraftTxid: undefined
      })
    ).toBeUndefined()
  })

  it('matches a saved draft when the builder is on another account', () => {
    expect(
      matchingUnbroadcastBoardTxid({
        activeAccountId: 'other',
        activeBroadcasted: false,
        activeTxid: undefined,
        linkedAccountId: 'btc-1',
        pendingTxids: [TXID],
        savedDraftTxid: TXID
      })
    ).toBe(TXID)
  })

  it('does not match an original draft whose txid is not the pending board', () => {
    expect(
      matchingUnbroadcastBoardTxid({
        activeAccountId: 'btc-1',
        activeBroadcasted: false,
        activeTxid: 'bb'.repeat(32),
        linkedAccountId: 'btc-1',
        pendingTxids: [TXID],
        savedDraftTxid: undefined
      })
    ).toBeUndefined()
  })
})

describe('isArkBoardPayjoinSend', () => {
  it('requires a payjoin URI and the board payjoin output label', () => {
    expect(
      isArkBoardPayjoinSend(
        [{ label: t('ark.board.payjoinFundLabel') }],
        PAYJOIN_URI
      )
    ).toBe(true)
    expect(
      isArkBoardPayjoinSend(
        [{ label: t('ark.board.depositLabel') }],
        PAYJOIN_URI
      )
    ).toBe(false)
    expect(
      isArkBoardPayjoinSend(
        [{ label: t('ark.board.payjoinFundLabel') }],
        undefined
      )
    ).toBe(false)
  })
})
