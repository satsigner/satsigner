import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { usePsbtNfcExport } from '@/hooks/usePsbtNfcExport'

const mockEmitter = {
  cancelNFCScan: jest.fn(),
  emitNFCTag: jest.fn(),
  isAvailable: true,
  isEmitting: false,
  isEnabled: true,
  isHardwareSupported: true
}
jest.mock<Partial<typeof import('@/hooks/useNFCEmitter')>>(
  '@/hooks/useNFCEmitter',
  () => ({ useNFCEmitter: () => mockEmitter })
)

type NfcExport = ReturnType<typeof usePsbtNfcExport>

async function renderNfcExport(serializedPsbt: string) {
  const onNotice = jest.fn()
  const hook: { current: NfcExport | null } = { current: null }
  function Harness() {
    hook.current = usePsbtNfcExport({ onNotice, serializedPsbt })
    return null
  }
  await act(async () => {
    create(createElement(Harness))
  })
  return { hook, onNotice }
}

describe('usePsbtNfcExport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEmitter.isEmitting = false
  })

  it('emits the PSBT and closes the modal once written', async () => {
    mockEmitter.emitNFCTag.mockResolvedValue(undefined)
    const { hook, onNotice } = await renderNfcExport('70736274ff01')

    await act(async () => {
      await hook.current?.exportToNfc()
    })

    expect(mockEmitter.emitNFCTag).toHaveBeenCalledWith('70736274ff01')
    expect(onNotice).toHaveBeenCalledWith({
      key: 'transaction.preview.nfcExported',
      type: 'success'
    })
    expect(hook.current?.nfcExportModalVisible).toBe(false)
    expect(hook.current?.nfcErrorKey).toBeNull()
  })

  it('keeps the modal open with the error when the write fails', async () => {
    mockEmitter.emitNFCTag.mockRejectedValue(new Error('tag lost'))
    const { hook, onNotice } = await renderNfcExport('70736274ff01')

    await act(async () => {
      await hook.current?.exportToNfc()
    })

    expect(hook.current?.nfcExportModalVisible).toBe(true)
    expect(hook.current?.nfcErrorKey).toBe('nfc.error.writeFailed')
    expect(onNotice).toHaveBeenCalledWith({
      key: 'nfc.error.writeFailed',
      type: 'error'
    })

    act(() => {
      hook.current?.closeNfcExportModal()
    })
    expect(hook.current?.nfcExportModalVisible).toBe(false)
    expect(hook.current?.nfcErrorKey).toBeNull()
  })

  it('reports a missing PSBT without emitting', async () => {
    const { hook, onNotice } = await renderNfcExport('')

    await act(async () => {
      await hook.current?.exportToNfc()
    })

    expect(mockEmitter.emitNFCTag).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith({
      key: 'error.psbt.notAvailable',
      type: 'error'
    })
    expect(hook.current?.nfcExportModalVisible).toBe(false)
  })

  it('cancels instead of emitting again while already emitting', async () => {
    mockEmitter.isEmitting = true
    const { hook } = await renderNfcExport('70736274ff01')

    await act(async () => {
      await hook.current?.exportToNfc()
    })

    expect(mockEmitter.cancelNFCScan).toHaveBeenCalledTimes(1)
    expect(mockEmitter.emitNFCTag).not.toHaveBeenCalled()
    expect(hook.current?.nfcExportModalVisible).toBe(false)
  })
})
