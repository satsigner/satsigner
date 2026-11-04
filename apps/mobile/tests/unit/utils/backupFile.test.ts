import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'

import {
  MAX_BACKUP_FILE_BYTES,
  MAX_BACKUP_INPUT_CHARS
} from '@/constants/backup'
import {
  isBackupTooLarge,
  loadBackupText,
  pickBackupFile,
  shouldHoldBackupOffscreen
} from '@/utils/backupFile'

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    readAsStringAsync: jest.fn()
  })
)

jest.mock<typeof import('expo-document-picker')>(
  'expo-document-picker',
  () => ({
    getDocumentAsync: jest.fn()
  })
)

const mockGetDocument = jest.mocked(DocumentPicker.getDocumentAsync)
const mockReadAsString = jest.mocked(FileSystem.readAsStringAsync)

function pickedAsset(
  size: number | undefined
): DocumentPicker.DocumentPickerResult {
  return {
    assets: [
      {
        lastModified: 0,
        mimeType: 'application/json',
        name: 'backup.json',
        size,
        uri: 'file:///cache/backup.json'
      }
    ],
    canceled: false
  }
}

describe('isBackupTooLarge', () => {
  it('allows backups up to the limit', () => {
    expect(isBackupTooLarge(MAX_BACKUP_FILE_BYTES)).toBe(false)
    expect(isBackupTooLarge(MAX_BACKUP_FILE_BYTES + 1)).toBe(true)
  })
})

describe('shouldHoldBackupOffscreen', () => {
  it('keeps short text in the input and long text off-screen', () => {
    expect(shouldHoldBackupOffscreen('a'.repeat(MAX_BACKUP_INPUT_CHARS))).toBe(
      false
    )
    expect(
      shouldHoldBackupOffscreen('a'.repeat(MAX_BACKUP_INPUT_CHARS + 1))
    ).toBe(true)
  })
})

describe('loadBackupText', () => {
  it('measures the text in utf-8 bytes', () => {
    expect(loadBackupText('{"a":"é"}')).toStrictEqual({
      backup: { sizeBytes: 10, text: '{"a":"é"}' },
      status: 'loaded'
    })
  })
})

describe('pickBackupFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reports a cancelled picker', async () => {
    mockGetDocument.mockResolvedValueOnce({ assets: null, canceled: true })

    await expect(pickBackupFile()).resolves.toStrictEqual({
      status: 'cancelled'
    })
    expect(mockReadAsString).not.toHaveBeenCalled()
  })

  it('rejects an oversized file without reading it', async () => {
    mockGetDocument.mockResolvedValueOnce(
      pickedAsset(MAX_BACKUP_FILE_BYTES + 1)
    )

    await expect(pickBackupFile()).resolves.toStrictEqual({
      status: 'tooLarge'
    })
    expect(mockReadAsString).not.toHaveBeenCalled()
  })

  it('reads the file when the picker does not report a size', async () => {
    mockGetDocument.mockResolvedValueOnce(pickedAsset(undefined))
    mockReadAsString.mockResolvedValueOnce('{"cipher":"ab"}')

    await expect(pickBackupFile()).resolves.toStrictEqual({
      backup: { sizeBytes: 15, text: '{"cipher":"ab"}' },
      status: 'loaded'
    })
    expect(mockReadAsString).toHaveBeenCalledWith('file:///cache/backup.json')
  })
})
