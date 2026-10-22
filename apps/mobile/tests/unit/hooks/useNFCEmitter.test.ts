import { createElement } from 'react'
import { NfcError } from 'react-native-nfc-manager'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { NfcCancelledError, NfcDisabledError } from '@/utils/nfcError'

const mockRequestTechnology = jest.fn()
const mockWriteNdefMessage = jest.fn()
jest.mock<typeof import('react-native-nfc-manager')>(
  'react-native-nfc-manager',
  () => {
    class UserCancelError extends Error {
      name = 'UserCancelError'
    }
    return {
      Ndef: {
        encodeMessage: () => [1, 2, 3],
        textRecord: () => ({})
      },
      NfcError: { UserCancel: UserCancelError },
      NfcTech: { Ndef: 'Ndef' },
      __esModule: true,
      default: {
        cancelTechnologyRequest: jest.fn(() => Promise.resolve()),
        ndefHandler: {
          writeNdefMessage: (bytes: number[]) => mockWriteNdefMessage(bytes)
        },
        requestTechnology: () => mockRequestTechnology()
      }
    }
  }
)

const mockAdapterStatus = { isEnabled: true, isSupported: true }
jest.mock<typeof import('@/utils/nfcAdapterStatus')>(
  '@/utils/nfcAdapterStatus',
  () => ({ getNfcAdapterStatus: () => Promise.resolve(mockAdapterStatus) })
)

// Unmounted after each test, so the hook's NFC availability retry timer does
// not fire once the test is done.
const mountedRenderers: ReactTestRenderer[] = []

type NfcEmitter = ReturnType<typeof useNFCEmitter>

async function renderEmitter() {
  const hook: { current: NfcEmitter | null } = { current: null }
  function Harness() {
    hook.current = useNFCEmitter()
    return null
  }
  await act(async () => {
    mountedRenderers.push(create(createElement(Harness)))
  })
  return hook
}

async function emitAndCatch(hook: { current: NfcEmitter | null }) {
  const result: { error?: unknown } = {}
  await act(async () => {
    try {
      await hook.current?.emitNFCTag('70736274ff01')
    } catch (error) {
      result.error = error
    }
  })
  return result.error
}

describe('useNFCEmitter emitNFCTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAdapterStatus.isEnabled = true
    mockRequestTechnology.mockResolvedValue(undefined)
    mockWriteNdefMessage.mockResolvedValue(undefined)
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mountedRenderers.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it('reports a session cancelled while waiting for a tag', async () => {
    mockRequestTechnology.mockRejectedValue(new NfcError.UserCancel())
    const hook = await renderEmitter()

    const error = await emitAndCatch(hook)

    expect(error).toBeInstanceOf(NfcCancelledError)
    expect(hook.current?.isEmitting).toBe(false)
    expect(mockWriteNdefMessage).not.toHaveBeenCalled()
  })

  it('reports a session cancelled while writing', async () => {
    mockWriteNdefMessage.mockRejectedValue(new NfcError.UserCancel())
    const hook = await renderEmitter()

    const error = await emitAndCatch(hook)

    expect(error).toBeInstanceOf(NfcCancelledError)
    expect(hook.current?.isEmitting).toBe(false)
  })

  it('describes other write failures', async () => {
    mockWriteNdefMessage.mockRejectedValue(new Error('tag is readonly'))
    const hook = await renderEmitter()

    const error = await emitAndCatch(hook)

    expect(error).not.toBeInstanceOf(NfcCancelledError)
    expect(error).toHaveProperty('message', 'This NFC tag is read-only.')
    expect(hook.current?.isEmitting).toBe(false)
  })

  it('reports NFC switched off without starting a session', async () => {
    mockAdapterStatus.isEnabled = false
    const hook = await renderEmitter()

    const error = await emitAndCatch(hook)

    expect(error).toBeInstanceOf(NfcDisabledError)
    expect(mockRequestTechnology).not.toHaveBeenCalled()
  })
})
