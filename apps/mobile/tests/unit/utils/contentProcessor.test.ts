import { DUST_LIMIT } from '@/constants/btc'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  getContentHref,
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
    expect(actions.onError).toHaveBeenCalledWith()
  })

  it('warns instead of setting an amount above the remaining balance', () => {
    const actions = outputActions(1000)
    processContentForOutput(
      content('bitcoin_uri', `bitcoin:${ADDRESS}?amount=0.001`),
      actions
    )
    expect(actions.onWarning).toHaveBeenCalledWith()
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
