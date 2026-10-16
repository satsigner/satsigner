import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { QR_COMPLEXITY_MAX, QRDisplayMode } from '@/constants/qr'
import { usePsbtQrExport } from '@/hooks/usePsbtQrExport'
import { createPsbtQrChunks } from '@/utils/qrExport'

jest.mock<Partial<typeof import('@/hooks/useAnimationFrameInterval')>>(
  '@/hooks/useAnimationFrameInterval',
  () => ({ useAnimationFrameInterval: jest.fn() })
)
jest.mock<Partial<typeof import('@/utils/qrExport')>>(
  '@/utils/qrExport',
  () => ({
    createPsbtQrChunks: jest.fn(),
    getQrAnimationIntervalMs: jest.fn(() => 1000)
  })
)

const mockCreateChunks = jest.mocked(createPsbtQrChunks)

type QrExport = ReturnType<typeof usePsbtQrExport>

async function renderQrExport(initialDisplayMode: QRDisplayMode) {
  const hook: { current: QrExport | null } = { current: null }
  function Harness() {
    hook.current = usePsbtQrExport('cHNidP8B', initialDisplayMode)
    return null
  }
  await act(async () => {
    create(createElement(Harness))
  })
  return hook
}

describe('usePsbtQrExport', () => {
  it('reports an error for a format that could not be encoded', async () => {
    mockCreateChunks.mockReturnValue({
      [QRDisplayMode.BBQR]: [],
      [QRDisplayMode.RAW]: ['raw'],
      [QRDisplayMode.UR]: ['ur']
    })
    const hook = await renderQrExport(QRDisplayMode.BBQR)

    expect(hook.current?.qrErrorKey).toBe('error.qr.generation')

    act(() => {
      hook.current?.setDisplayMode(QRDisplayMode.RAW)
    })
    expect(hook.current?.qrErrorKey).toBeNull()
  })

  it('notes when max density still needs several QRs', async () => {
    mockCreateChunks.mockReturnValue({
      [QRDisplayMode.BBQR]: ['b1'],
      [QRDisplayMode.RAW]: ['p1of2 a', 'p2of2 b'],
      [QRDisplayMode.UR]: ['u1']
    })
    const hook = await renderQrExport(QRDisplayMode.RAW)

    expect(hook.current?.showMaxDensityNote).toBe(false)
    for (const _step of Array.from({ length: QR_COMPLEXITY_MAX })) {
      act(() => {
        hook.current?.increaseComplexity()
      })
    }
    expect(hook.current?.qrComplexity).toBe(QR_COMPLEXITY_MAX)
    expect(hook.current?.showMaxDensityNote).toBe(true)
  })
})
