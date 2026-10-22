import { createElement } from 'react'
import { NfcError } from 'react-native-nfc-manager'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { useNFCReader } from '@/hooks/useNFCReader'
import { NfcCancelledError, NfcDisabledError } from '@/utils/nfcError'

const mockRequestTechnology = jest.fn()
const mockGetTag = jest.fn()
const mockCancelTechnologyRequest = jest.fn()
jest.mock<typeof import('react-native-nfc-manager')>(
  'react-native-nfc-manager',
  () => {
    class UserCancelError extends Error {
      name = 'UserCancelError'
    }
    return {
      Ndef: {},
      NfcError: { UserCancel: UserCancelError },
      NfcTech: { Ndef: 'Ndef' },
      __esModule: true,
      default: {
        cancelTechnologyRequest: () => mockCancelTechnologyRequest(),
        getTag: () => mockGetTag(),
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

type NfcReader = ReturnType<typeof useNFCReader>

async function renderReader() {
  const hook: { current: NfcReader | null } = { current: null }
  function Harness() {
    hook.current = useNFCReader()
    return null
  }
  await act(async () => {
    mountedRenderers.push(create(createElement(Harness)))
  })
  return hook
}

async function readAndCatch(hook: { current: NfcReader | null }) {
  const result: { error?: unknown } = {}
  await act(async () => {
    try {
      await hook.current?.readNFCTag()
    } catch (error) {
      result.error = error
    }
  })
  return result.error
}

describe('useNFCReader readNFCTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAdapterStatus.isEnabled = true
    mockRequestTechnology.mockResolvedValue(undefined)
    mockCancelTechnologyRequest.mockResolvedValue(undefined)
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mountedRenderers.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it('reports a cancelled session and stops reading', async () => {
    mockRequestTechnology.mockRejectedValue(new NfcError.UserCancel())
    const hook = await renderReader()

    const error = await readAndCatch(hook)

    expect(error).toBeInstanceOf(NfcCancelledError)
    expect(hook.current?.isReading).toBe(false)
    expect(mockCancelTechnologyRequest).not.toHaveBeenCalled()
  })

  it('closes the NFC request when reading the tag fails', async () => {
    const failure = new Error('tag lost')
    mockGetTag.mockRejectedValue(failure)
    const hook = await renderReader()

    const error = await readAndCatch(hook)

    expect(error).toBe(failure)
    expect(mockCancelTechnologyRequest).toHaveBeenCalledTimes(1)
    expect(hook.current?.isReading).toBe(false)
  })

  it('waits for the failed session to close before ending the read', async () => {
    mockGetTag.mockRejectedValue(new Error('tag lost'))
    const sessionClosed = { resolve: () => {} }
    mockCancelTechnologyRequest.mockReturnValue(
      new Promise<void>((resolve) => {
        sessionClosed.resolve = resolve
      })
    )
    const hook = await renderReader()
    const read = { settled: false }

    await act(async () => {
      const pendingRead = hook.current
        ?.readNFCTag()
        .catch(() => null)
        .finally(() => {
          read.settled = true
        })
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
      expect(read.settled).toBe(false)

      sessionClosed.resolve()
      await pendingRead
    })

    expect(read.settled).toBe(true)
    expect(hook.current?.isReading).toBe(false)
  })

  it('passes other session failures through and stops reading', async () => {
    const failure = new Error('tag lost')
    mockRequestTechnology.mockRejectedValue(failure)
    const hook = await renderReader()

    const error = await readAndCatch(hook)

    expect(error).toBe(failure)
    expect(hook.current?.isReading).toBe(false)
  })

  it('reports NFC switched off without starting a session', async () => {
    mockAdapterStatus.isEnabled = false
    const hook = await renderReader()

    const error = await readAndCatch(hook)

    expect(error).toBeInstanceOf(NfcDisabledError)
    expect(mockRequestTechnology).not.toHaveBeenCalled()
  })
})
