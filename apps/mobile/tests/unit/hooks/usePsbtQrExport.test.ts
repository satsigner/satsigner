import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

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

const SINGLE_FRAME_CHUNKS = {
  [QRDisplayMode.BBQR]: ['bbqr'],
  [QRDisplayMode.RAW]: ['raw'],
  [QRDisplayMode.UR]: ['ur']
}

async function renderQrExport(
  initialDisplayMode: QRDisplayMode,
  initiallyActive = true
) {
  const hook: { current: QrExport | null } = { current: null }
  function Harness({ active }: { active: boolean }) {
    hook.current = usePsbtQrExport('cHNidP8B', initialDisplayMode, active)
    return null
  }
  const renderer: { current: ReactTestRenderer | null } = { current: null }
  await act(async () => {
    renderer.current = create(
      createElement(Harness, { active: initiallyActive })
    )
  })
  async function setActive(active: boolean) {
    await act(async () => {
      renderer.current?.update(createElement(Harness, { active }))
    })
  }
  return { hook, setActive }
}

describe('usePsbtQrExport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reports an error for a format that could not be encoded', async () => {
    mockCreateChunks.mockReturnValue({
      [QRDisplayMode.BBQR]: [],
      [QRDisplayMode.RAW]: ['raw'],
      [QRDisplayMode.UR]: ['ur']
    })
    const { hook } = await renderQrExport(QRDisplayMode.BBQR)

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
    const { hook } = await renderQrExport(QRDisplayMode.RAW)

    expect(hook.current?.showMaxDensityNote).toBe(false)
    for (const _step of Array.from({ length: QR_COMPLEXITY_MAX })) {
      act(() => {
        hook.current?.increaseComplexity()
      })
    }
    expect(hook.current?.qrComplexity).toBe(QR_COMPLEXITY_MAX)
    expect(hook.current?.showMaxDensityNote).toBe(true)
  })

  it('encodes nothing until the modal first opens', async () => {
    mockCreateChunks.mockReturnValue(SINGLE_FRAME_CHUNKS)
    const { hook, setActive } = await renderQrExport(QRDisplayMode.RAW, false)

    expect(mockCreateChunks).not.toHaveBeenCalled()

    await setActive(true)
    expect(mockCreateChunks).toHaveBeenCalledWith(
      'cHNidP8B',
      expect.any(Number)
    )
    expect(hook.current?.getQRValue()).toBe('raw')
  })

  it('keeps showing the frames while the modal closes', async () => {
    mockCreateChunks.mockReturnValue(SINGLE_FRAME_CHUNKS)
    const { hook, setActive } = await renderQrExport(QRDisplayMode.RAW)

    await setActive(false)
    expect(hook.current?.qrErrorKey).toBeNull()
    expect(hook.current?.getQRValue()).toBe('raw')
  })
})
