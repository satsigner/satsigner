import { Share } from 'react-native'

import { shareExistingFile } from '@/utils/filesystem'
import { shareImage, shareText } from '@/utils/share'

jest.mock<typeof import('@/utils/filesystem')>('@/utils/filesystem', () => ({
  shareExistingFile: jest.fn()
}))

jest.mock<typeof import('react-native')>('react-native', () => ({
  Share: { share: jest.fn() }
}))

const mockShare = jest.mocked(Share.share)
const mockShareExistingFile = jest.mocked(shareExistingFile)

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
