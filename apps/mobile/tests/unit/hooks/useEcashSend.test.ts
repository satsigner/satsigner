import { bech32 } from 'bech32'
import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { toast } from 'sonner-native'

import { useEcashSend } from '@/hooks/useEcashSend'
import { fetchLNURLPayDetails } from '@/utils/lnurl'

import { cashuTokens, lightningInvoices } from '../utils/bip321Samples'

jest.mock<typeof import('expo-router')>('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), dismissTo: jest.fn() })
}))
jest.mock<typeof import('@/hooks/useLND')>('@/hooks/useLND', () => ({
  useLND: () => ({ isConnected: false, makeRequest: jest.fn() })
}))
jest.mock<typeof import('@/hooks/useNFCEmitter')>(
  '@/hooks/useNFCEmitter',
  () => ({
    useNFCEmitter: () => ({
      emitNFCTag: jest.fn(),
      isEmitting: false,
      isHardwareSupported: false
    })
  })
)
jest.mock<typeof import('@/utils/lnurl')>('@/utils/lnurl', () => ({
  ...jest.requireActual<typeof import('@/utils/lnurl')>('@/utils/lnurl'),
  fetchLNURLPayDetails: jest.fn()
}))

// BOLT 11 spec test vector; the bip321 sample invoices have no valid checksum.
const DECODABLE_INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql'
const PASTED = 'Invoice pasted from clipboard'
const UNSUPPORTED = 'Not a Lightning invoice or LNURL-pay code'
const LNURL_MAX_LENGTH = 1023

function encodeLnurl(url: string) {
  return bech32.encode(
    'lnurl',
    bech32.toWords(Buffer.from(url, 'utf8')),
    LNURL_MAX_LENGTH
  )
}

const mountedRenderers: ReactTestRenderer[] = []

function renderUseEcashSend() {
  const result: { current: ReturnType<typeof useEcashSend> | null } = {
    current: null
  }
  function Harness() {
    result.current = useEcashSend()
    return null
  }
  act(() => {
    mountedRenderers.push(create(createElement(Harness)))
  })
  return result
}

async function paste(text: string) {
  const result = renderUseEcashSend()
  await act(async () => {
    await result.current?.applyInvoiceInput(text, PASTED)
  })
  return result
}

describe('useEcashSend applyInvoiceInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(fetchLNURLPayDetails).mockResolvedValue({
      callback: 'https://service.example/lnurlp/alice/callback',
      maxSendable: 100_000,
      metadata: '[]',
      minSendable: 1000,
      tag: 'payRequest'
    })
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mountedRenderers.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it('confirms a pasted Lightning invoice', async () => {
    await paste(DECODABLE_INVOICE)

    expect(toast.success).toHaveBeenCalledWith(PASTED)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('confirms a pasted lightning: URI', async () => {
    await paste(`lightning:${DECODABLE_INVOICE}`)

    expect(toast.success).toHaveBeenCalledWith(PASTED)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('confirms a pasted LNURL-pay code', async () => {
    await paste(encodeLnurl('https://service.example/lnurlp/alice'))

    expect(toast.success).toHaveBeenCalledWith(PASTED)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('reports content that is not an invoice instead of confirming it', async () => {
    const result = await paste(cashuTokens.valid.v4)

    expect(toast.error).toHaveBeenCalledWith(UNSUPPORTED)
    expect(toast.success).not.toHaveBeenCalled()
    expect(result.current?.invoice).toBe('')
  })

  it('keeps a pasted invoice in the field', async () => {
    const result = await paste(DECODABLE_INVOICE)

    expect(result.current?.invoice).toBe(DECODABLE_INVOICE)
  })

  it('does not confirm an invoice that cannot be decoded', async () => {
    const result = await paste(lightningInvoices.mainnet.basic)

    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(result.current?.invoice).toBe(lightningInvoices.mainnet.basic)
  })

  it('does not confirm an LNURL-pay code whose details cannot be fetched', async () => {
    jest.mocked(fetchLNURLPayDetails).mockRejectedValue(new Error('offline'))

    await paste(encodeLnurl('https://service.example/lnurlp/alice'))

    expect(toast.success).not.toHaveBeenCalled()
  })

  it('only explains that an LNURL-withdraw code belongs in Receive', async () => {
    const result = await paste(
      encodeLnurl('https://service.example/lnurlw/abc')
    )
    expect(result.current?.invoice).toBe('')

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      'LNURL withdraw codes should be used in the Receive tab'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })
})
