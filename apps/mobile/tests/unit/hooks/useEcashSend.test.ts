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
    await paste(lightningInvoices.mainnet.basic)

    expect(toast.success).toHaveBeenCalledWith(PASTED)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('confirms a pasted lightning: URI', async () => {
    await paste(`lightning:${lightningInvoices.mainnet.basic}`)

    expect(toast.success).toHaveBeenCalledWith(PASTED)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('confirms a pasted LNURL-pay code', async () => {
    await paste(encodeLnurl('https://service.example/lnurlp/alice'))

    expect(toast.success).toHaveBeenCalledWith(PASTED)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('reports content that is not an invoice instead of confirming it', async () => {
    await paste(cashuTokens.valid.v4)

    expect(toast.error).toHaveBeenCalledWith(UNSUPPORTED)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('only explains that an LNURL-withdraw code belongs in Receive', async () => {
    await paste(encodeLnurl('https://service.example/lnurlw/abc'))

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      'LNURL withdraw codes should be used in the Receive tab'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })
})
