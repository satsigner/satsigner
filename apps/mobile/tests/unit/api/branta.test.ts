import { lookupBrantaPayee } from '@/api/branta'
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

function clientWith(result: { payments: unknown[]; verifyUrl: string }) {
  return {
    getPayments: jest.fn(async () => result),
    getPaymentsByQrCode: jest.fn(async () => result)
  }
}

describe('lookupBrantaPayee', () => {
  beforeEach(() => {
    useSettingsStore.setState({ brantaLookupEnabled: true })
  })

  afterEach(() => {
    useSettingsStore.setState({
      brantaLabelSyncEnabled: false,
      brantaLookupEnabled: false,
      brantaTorEnabled: false
    })
  })

  it('does not contact Branta while lookup is off', async () => {
    useSettingsStore.setState({ brantaLookupEnabled: false })
    const client = clientWith({
      payments: [payment],
      verifyUrl: payee.verifyUrl
    })

    await expect(
      lookupBrantaPayee('bc1qexample', 'paste', client)
    ).resolves.toBeNull()

    expect(client.getPayments).not.toHaveBeenCalled()
    expect(client.getPaymentsByQrCode).not.toHaveBeenCalled()
  })

  it('does not call Branta for an empty destination', async () => {
    const client = clientWith({ payments: [], verifyUrl: '' })

    await expect(lookupBrantaPayee('   ', 'paste', client)).resolves.toBeNull()

    expect(client.getPayments).not.toHaveBeenCalled()
    expect(client.getPaymentsByQrCode).not.toHaveBeenCalled()
  })

  it('looks up a scanned QR with the full payload', async () => {
    const qr = 'bitcoin:bc1qexample?branta_id=1&branta_secret=2'
    const client = clientWith({
      payments: [payment],
      verifyUrl: payee.verifyUrl
    })

    await expect(lookupBrantaPayee(qr, 'qr', client)).resolves.toStrictEqual(
      payee
    )

    expect(client.getPaymentsByQrCode).toHaveBeenCalledWith(
      qr,
      undefined,
      expect.any(AbortSignal)
    )
    expect(client.getPayments).not.toHaveBeenCalled()
  })

  it('looks up a pasted bitcoin URI with the QR parser', async () => {
    const uri = 'bitcoin:bc1qexample?branta_id=1&branta_secret=2'
    const client = clientWith({
      payments: [payment],
      verifyUrl: payee.verifyUrl
    })

    await expect(
      lookupBrantaPayee(uri, 'paste', client)
    ).resolves.toStrictEqual(payee)

    expect(client.getPaymentsByQrCode).toHaveBeenCalledWith(
      uri,
      undefined,
      expect.any(AbortSignal)
    )
    expect(client.getPayments).not.toHaveBeenCalled()
  })

  it('looks up pasted text with getPayments', async () => {
    const pasted = 'lnbc1example'
    const client = clientWith({
      payments: [payment],
      verifyUrl: payee.verifyUrl
    })

    await expect(
      lookupBrantaPayee(pasted, 'paste', client)
    ).resolves.toStrictEqual(payee)

    expect(client.getPayments).toHaveBeenCalledWith(
      pasted,
      undefined,
      undefined,
      expect.any(AbortSignal)
    )
  })

  it('returns null when the destination is unknown', async () => {
    const client = clientWith({ payments: [], verifyUrl: '' })

    await expect(
      lookupBrantaPayee('bc1qexample', 'paste', client)
    ).resolves.toBeNull()
  })

  it('returns null when the lookup fails', async () => {
    const client = {
      getPayments: jest.fn(async () => {
        throw new Error('network')
      }),
      getPaymentsByQrCode: jest.fn()
    }

    await expect(
      lookupBrantaPayee('bc1qexample', 'paste', client)
    ).resolves.toBeNull()
  })
})
