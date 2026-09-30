import { DUST_LIMIT } from '@/constants/btc'
import { t } from '@/locales'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  getBitcoinContentHref,
  getContentHref,
  isDustPaymentAmount,
  parseScannedPaymentUri,
  processContentForOutput
} from '@/utils/contentProcessor'

const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

function content(
  type: DetectedContent['type'],
  cleaned: string
): DetectedContent {
  return { cleaned, isValid: true, raw: cleaned, type }
}

function outputActions(remainingSats?: number) {
  return {
    onError: jest.fn(),
    onWarning: jest.fn(),
    remainingSats,
    setOutputAmount: jest.fn(),
    setOutputLabel: jest.fn(),
    setOutputTo: jest.fn(),
    setPayjoinUri: jest.fn()
  }
}

describe('getContentHref', () => {
  it('routes invoices to the context pay screen', () => {
    expect(
      getContentHref(content('lightning_invoice', 'lnbc1'), 'lightning')
    ).toStrictEqual({
      params: { invoice: 'lnbc1', type: 'lightning_invoice' },
      pathname: '/signer/lightning/pay'
    })
    expect(getContentHref(content('lnurl', 'lnurl1'), 'ecash')).toMatchObject({
      pathname: '/signer/ecash/send'
    })
  })

  it('routes ecash tokens to receive and ignores the rest', () => {
    expect(
      getContentHref(content('ecash_token', 'cashuA1'), 'ecash')
    ).toMatchObject({ pathname: '/signer/ecash/receive' })
    expect(
      getContentHref(content('ecash_token', 'cashuA1'), 'lightning')
    ).toBeNull()
  })
})

describe('processContentForOutput', () => {
  it('fills address, amount and label from a BIP21 uri', () => {
    const actions = outputActions()
    const result = processContentForOutput(
      content('bitcoin_uri', `bitcoin:${ADDRESS}?amount=0.001&label=Tip`),
      actions
    )
    expect(result).toStrictEqual({ ok: true, payjoin: false })
    expect(actions.setOutputTo).toHaveBeenCalledWith(ADDRESS)
    expect(actions.setOutputAmount).toHaveBeenCalledWith(100_000)
    expect(actions.setOutputLabel).toHaveBeenCalledWith('Tip')
    expect(actions.setPayjoinUri).toHaveBeenCalledWith(undefined)
  })

  it('rejects dust amounts', () => {
    const actions = outputActions()
    const dustBtc = (DUST_LIMIT - 1) / 100_000_000
    const result = processContentForOutput(
      content('bitcoin_uri', `bitcoin:${ADDRESS}?amount=${dustBtc}`),
      actions
    )
    expect(result.ok).toBe(false)
    expect(actions.onError).toHaveBeenCalledWith(
      t('transaction.error.dustOutputBelowLimit')
    )
  })

  it('warns instead of setting an amount above the remaining balance', () => {
    const actions = outputActions(1000)
    processContentForOutput(
      content('bitcoin_uri', `bitcoin:${ADDRESS}?amount=0.001`),
      actions
    )
    expect(actions.onWarning).toHaveBeenCalledWith(
      t('transaction.error.insufficientFundsForAmount')
    )
    expect(actions.setOutputAmount).not.toHaveBeenCalled()
  })

  it('flags payjoin uris', () => {
    const actions = outputActions()
    const uri = `bitcoin:${ADDRESS}?amount=0.001&pj=https://payjo.in/mb`
    expect(
      processContentForOutput(content('bitcoin_uri', uri), actions)
    ).toStrictEqual({ ok: true, payjoin: true })
    expect(actions.setPayjoinUri).toHaveBeenCalledWith(uri)
  })
})

describe('parseScannedPaymentUri', () => {
  it('reads amount in sats and label from a BIP21 uri', () => {
    expect(
      parseScannedPaymentUri(
        content('bitcoin_uri', `bitcoin:${ADDRESS}?amount=0.001&label=Tip`)
      )
    ).toStrictEqual({ address: ADDRESS, amountSats: 100_000, label: 'Tip' })
  })

  it('falls back to 1 sat when no amount is set', () => {
    expect(
      parseScannedPaymentUri(content('bitcoin_uri', ADDRESS))?.amountSats
    ).toBe(1)
  })

  it('rejects content without an address', () => {
    expect(parseScannedPaymentUri(content('bitcoin_uri', '?x=1'))).toBeNull()
  })
})

describe('isDustPaymentAmount', () => {
  it('treats the 1 sat placeholder as unset, not dust', () => {
    expect(isDustPaymentAmount(1)).toBe(false)
    expect(isDustPaymentAmount(DUST_LIMIT - 1)).toBe(true)
    expect(isDustPaymentAmount(DUST_LIMIT)).toBe(false)
  })
})

describe('getBitcoinContentHref', () => {
  it('converts hex psbts to base64 for the preview screen', () => {
    expect(
      getBitcoinContentHref(content('psbt', '70736274ff'), 'acc')
    ).toStrictEqual({
      params: { id: 'acc', psbt: 'cHNidP8=' },
      pathname: '/signer/bitcoin/account/[id]/signAndSend/previewTransaction'
    })
  })

  it('leaves addresses to the output flow', () => {
    expect(
      getBitcoinContentHref(content('bitcoin_address', ADDRESS), 'acc')
    ).toBeNull()
  })
})
