import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { usePsbtSignatureImport } from '@/hooks/usePsbtSignatureImport'

jest.mock<Partial<typeof import('@/hooks/useClipboardPaste')>>(
  '@/hooks/useClipboardPaste',
  () => ({
    useClipboardPaste: () => ({
      pasteFromClipboard: jest.fn(),
      pasteFromClipboardSilent: jest.fn(),
      pasteFromClipboardWithValidation: jest.fn()
    })
  })
)

const mockReadNFCTag = jest.fn()
jest.mock<Partial<typeof import('@/hooks/useNFCReader')>>(
  '@/hooks/useNFCReader',
  () => ({
    useNFCReader: () => ({
      cancelNFCScan: jest.fn(),
      isAvailable: true,
      isEnabled: true,
      isHardwareSupported: true,
      isReading: false,
      readNFCTag: mockReadNFCTag
    })
  })
)

type SignatureImport = ReturnType<typeof usePsbtSignatureImport>

async function renderSignatureImport(
  props: Parameters<typeof usePsbtSignatureImport>[0]
) {
  const hook: { current: SignatureImport | null } = { current: null }
  function Harness() {
    hook.current = usePsbtSignatureImport(props)
    return null
  }
  await act(async () => {
    create(createElement(Harness))
  })
  return hook
}

describe('usePsbtSignatureImport importFromNfc', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('binds the NFC transaction to the PSBT under review', async () => {
    mockReadNFCTag.mockResolvedValue({ txData: new Uint8Array([0xab, 0xcd]) })
    const importSignedData = jest.fn(() => true)
    const onNotice = jest.fn()
    const hook = await renderSignatureImport({
      importSignedData,
      onNotice,
      signWithMnemonic: jest.fn()
    })

    await act(async () => {
      await hook.current?.importFromNfc(1)
    })

    expect(importSignedData).toHaveBeenCalledWith(1, 'abcd')
    expect(onNotice).toHaveBeenCalledWith({
      key: 'transaction.preview.nfcImported',
      type: 'success'
    })
  })

  it('does not report success when the binding rejects the data', async () => {
    mockReadNFCTag.mockResolvedValue({ txData: new Uint8Array([0xab]) })
    const onNotice = jest.fn()
    const hook = await renderSignatureImport({
      importSignedData: () => false,
      onNotice,
      signWithMnemonic: jest.fn()
    })

    await act(async () => {
      await hook.current?.importFromNfc(0)
    })

    expect(onNotice).not.toHaveBeenCalled()
  })

  it('rejects a tag that only carries a txid', async () => {
    mockReadNFCTag.mockResolvedValue({ txId: 'ab'.repeat(32) })
    const importSignedData = jest.fn(() => true)
    const onNotice = jest.fn()
    const hook = await renderSignatureImport({
      importSignedData,
      onNotice,
      signWithMnemonic: jest.fn()
    })

    await act(async () => {
      await hook.current?.importFromNfc(0)
    })

    expect(importSignedData).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith({
      key: 'watchonly.read.nfcErrorNoData',
      type: 'error'
    })
  })
})
