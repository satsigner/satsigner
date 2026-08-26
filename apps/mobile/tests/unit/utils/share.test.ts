import { type RefObject } from 'react'
import { Share, type View } from 'react-native'
import { captureRef } from 'react-native-view-shot'

import { shareExistingFile } from '@/utils/filesystem'
import { shareImage, shareText, shareViewAsImage } from '@/utils/share'

jest.mock<typeof import('@/utils/filesystem')>('@/utils/filesystem', () => ({
  shareExistingFile: jest.fn()
}))

jest.mock<typeof import('react-native')>('react-native', () => ({
  Share: { share: jest.fn() }
}))

jest.mock<typeof import('react-native-view-shot')>(
  'react-native-view-shot',
  () => ({
    captureRef: jest.fn()
  })
)

const mockShare = jest.mocked(Share.share)
const mockShareExistingFile = jest.mocked(shareExistingFile)
const mockCaptureRef = jest.mocked(captureRef)

describe('shareText', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shares the message without options when no dialog title is given', async () => {
    mockShare.mockResolvedValueOnce({ action: 'sharedAction' })

    await shareText({ content: 'hello world' })

    expect(mockShare).toHaveBeenCalledWith(
      { message: 'hello world' },
      undefined
    )
  })

  it('passes the dialog title through as share options', async () => {
    mockShare.mockResolvedValueOnce({ action: 'sharedAction' })

    await shareText({ content: 'hello world', dialogTitle: 'Share note' })

    expect(mockShare).toHaveBeenCalledWith(
      { message: 'hello world' },
      { dialogTitle: 'Share note' }
    )
  })

  it('silently ignores a share failure', async () => {
    mockShare.mockRejectedValueOnce(new Error('cancelled'))

    await expect(shareText({ content: 'hello' })).resolves.toBeUndefined()
  })
})

describe('shareImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shares the image file with the default mime type', async () => {
    mockShareExistingFile.mockResolvedValueOnce(undefined)

    await shareImage({ dialogTitle: 'Share QR', uri: 'file:///qr.png' })

    expect(mockShareExistingFile).toHaveBeenCalledWith({
      dialogTitle: 'Share QR',
      fileUri: 'file:///qr.png',
      mimeType: 'image/png'
    })
  })

  it('silently ignores a share failure', async () => {
    mockShareExistingFile.mockRejectedValueOnce(new Error('unavailable'))

    await expect(
      shareImage({ dialogTitle: 'Share QR', uri: 'file:///qr.png' })
    ).resolves.toBeUndefined()
  })
})

describe('shareViewAsImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function refWithView(current: View | null): RefObject<View | null> {
    return { current }
  }

  it('does nothing when the ref has no attached view', async () => {
    await shareViewAsImage({
      dialogTitle: 'Share QR',
      viewRef: refWithView(null)
    })

    expect(mockCaptureRef).not.toHaveBeenCalled()
    expect(mockShareExistingFile).not.toHaveBeenCalled()
  })

  it('captures the view as PNG and shares the resulting file', async () => {
    const view = {} as View
    mockCaptureRef.mockResolvedValueOnce('file:///cache/qr-capture.png')
    mockShareExistingFile.mockResolvedValueOnce(undefined)

    await shareViewAsImage({
      dialogTitle: 'Share QR',
      viewRef: refWithView(view)
    })

    expect(mockCaptureRef).toHaveBeenCalledWith(refWithView(view), {
      format: 'png',
      result: 'tmpfile'
    })
    expect(mockShareExistingFile).toHaveBeenCalledWith({
      dialogTitle: 'Share QR',
      fileUri: 'file:///cache/qr-capture.png',
      mimeType: 'image/png'
    })
  })

  it('propagates a capture failure so the caller can surface it', async () => {
    const view = {} as View
    mockCaptureRef.mockRejectedValueOnce(new Error('capture failed'))

    await expect(
      shareViewAsImage({ dialogTitle: 'Share QR', viewRef: refWithView(view) })
    ).rejects.toThrow('capture failed')
    expect(mockShareExistingFile).not.toHaveBeenCalled()
  })

  it('silently ignores a share failure after a successful capture', async () => {
    const view = {} as View
    mockCaptureRef.mockResolvedValueOnce('file:///cache/qr-capture.png')
    mockShareExistingFile.mockRejectedValueOnce(new Error('unavailable'))

    await expect(
      shareViewAsImage({ dialogTitle: 'Share QR', viewRef: refWithView(view) })
    ).resolves.toBeUndefined()
  })
})
