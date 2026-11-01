import {
  BrantaPaymentException,
  BrantaPaymentExceptionReason
} from '@branta-ops/branta'

import {
  allowBrantaLookup,
  lookupBrantaPayee,
  resetBrantaLookupPermits
} from '@/api/branta'
import { useSettingsStore } from '@/store/settings'
import { type BrantaPayee } from '@/types/models/Branta'

const payee: BrantaPayee = {
  description: 'March invoice',
  logoUrl: 'https://guardrail.branta.pro/logo.png',
  name: 'Acme',
  verifyUrl: 'https://guardrail.branta.pro/v2/verify/abc'
}

const payment = {
  description: 'March invoice',
  platform: 'Acme',
  platformLogoUrl: 'https://guardrail.branta.pro/logo.png'
}

const missed = { notice: null, payee: null }

function clientWith(result: {
  payments?: unknown[]
  status: string
  verifyUrl: string
}) {
  return {
    verify: jest.fn(async () => result)
  }
}

describe('lookupBrantaPayee', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      brantaLookupMode: 'always',
      brantaLookupWarningDismissed: true
    })
    allowBrantaLookup()
  })

  afterEach(() => {
    resetBrantaLookupPermits()
    useSettingsStore.setState({
      brantaLabelSyncEnabled: false,
      brantaLookupMode: 'off',
      brantaLookupWarningDismissed: false,
      brantaTorEnabled: false
    })
  })

  it('does not contact Branta without a confirmed lookup', async () => {
    resetBrantaLookupPermits()
    const client = clientWith({
      payments: [payment],
      status: 'match',
      verifyUrl: payee.verifyUrl
    })

    await expect(lookupBrantaPayee('bc1qexample', client)).resolves.toStrictEqual(
      missed
    )
    expect(client.verify).not.toHaveBeenCalled()
  })

  it('does not contact Branta while lookup is off', async () => {
    useSettingsStore.setState({ brantaLookupMode: 'off' })
    const client = clientWith({
      payments: [payment],
      status: 'match',
      verifyUrl: payee.verifyUrl
    })

    await expect(lookupBrantaPayee('bc1qexample', client)).resolves.toStrictEqual(
      missed
    )

    expect(client.verify).not.toHaveBeenCalled()
  })

  it('does not call Branta for an empty destination', async () => {
    const client = clientWith({ status: 'unknown', verifyUrl: '' })

    await expect(lookupBrantaPayee('   ', client)).resolves.toStrictEqual(missed)

    expect(client.verify).not.toHaveBeenCalled()
  })

  it('verifies a scanned QR with the full payload', async () => {
    const qr = 'bitcoin:bc1qexample?branta_id=1&branta_secret=2'
    const client = clientWith({
      payments: [payment],
      status: 'match',
      verifyUrl: payee.verifyUrl
    })

    await expect(lookupBrantaPayee(qr, client)).resolves.toStrictEqual({
      notice: null,
      payee
    })

    expect(client.verify).toHaveBeenCalledWith(
      qr,
      undefined,
      expect.any(AbortSignal)
    )
  })

  it('verifies a pasted bitcoin URI with the full payload', async () => {
    const uri = 'bitcoin:bc1qexample?branta_id=1&branta_secret=2'
    const client = clientWith({
      payments: [payment],
      status: 'match',
      verifyUrl: payee.verifyUrl
    })

    await expect(lookupBrantaPayee(uri, client)).resolves.toStrictEqual({
      notice: null,
      payee
    })

    expect(client.verify).toHaveBeenCalledWith(
      uri,
      undefined,
      expect.any(AbortSignal)
    )
  })

  it('verifies pasted text with the same call', async () => {
    const pasted = 'lnbc1example'
    const client = clientWith({
      payments: [payment],
      status: 'match',
      verifyUrl: payee.verifyUrl
    })

    await expect(lookupBrantaPayee(pasted, client)).resolves.toStrictEqual({
      notice: null,
      payee
    })

    expect(client.verify).toHaveBeenCalledWith(
      pasted,
      undefined,
      expect.any(AbortSignal)
    )
  })

  it('returns no payee when the destination is unknown', async () => {
    const client = clientWith({ status: 'unknown', verifyUrl: '' })

    await expect(lookupBrantaPayee('bc1qexample', client)).resolves.toStrictEqual(
      missed
    )
  })

  it('warns when the destination was altered', async () => {
    const client = clientWith({
      status: 'tampered',
      verifyUrl: payee.verifyUrl
    })

    await expect(lookupBrantaPayee('bc1qexample', client)).resolves.toStrictEqual({
      notice: 'tampered',
      payee: null
    })
  })

  it('warns when the lookup does not finish', async () => {
    const client = clientWith({
      status: 'incomplete',
      verifyUrl: ''
    })

    await expect(lookupBrantaPayee('bc1qexample', client)).resolves.toStrictEqual({
      notice: 'incomplete',
      payee: null
    })
  })

  it('does not treat a failed lookup as unknown', async () => {
    const client = {
      verify: jest.fn(async () => {
        throw new Error('network')
      })
    }

    await expect(lookupBrantaPayee('bc1qexample', client)).resolves.toStrictEqual({
      notice: 'incomplete',
      payee: null
    })
  })

  it('does not treat missing crypto as unknown', async () => {
    const client = {
      verify: jest.fn(async () => {
        throw new BrantaPaymentException(
          'crypto',
          BrantaPaymentExceptionReason.CryptoUnavailable
        )
      })
    }

    await expect(lookupBrantaPayee('bc1qexample', client)).resolves.toStrictEqual({
      notice: 'unavailable',
      payee: null
    })
  })
})
