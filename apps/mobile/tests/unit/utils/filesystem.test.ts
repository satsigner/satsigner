import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

import { saveDocument } from '@/modules/saf-save'
import {
  saveExistingFile,
  saveFile,
  shareExistingFile
} from '@/utils/filesystem'

jest.mock<typeof import('@/modules/saf-save')>('@/modules/saf-save', () => ({
  saveDocument: jest.fn()
}))

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    EncodingType: { Base64: 'base64', UTF8: 'utf8' },
    documentDirectory: 'file:///doc/',
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn()
  })
)

jest.mock<typeof import('expo-sharing')>('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn()
}))

jest.mock<typeof import('expo-document-picker')>(
  'expo-document-picker',
  () => ({
    getDocumentAsync: jest.fn()
  })
)

jest.mock<typeof import('react-native')>('react-native', () => ({
  Platform: { OS: 'ios' }
}))

const mockIsAvailable = jest.mocked(Sharing.isAvailableAsync)
const mockShare = jest.mocked(Sharing.shareAsync)
const mockReadAsString = jest.mocked(FileSystem.readAsStringAsync)
const mockWriteAsString = jest.mocked(FileSystem.writeAsStringAsync)
const mockSaveDocument = jest.mocked(saveDocument)

const SRC_URI = 'file:///doc/ark/acc-1/bark.db'
const DIALOG = 'Export wallet database'
const MIME = 'application/octet-stream'
const FILENAME = 'bark.db'

describe('shareExistingFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'ios'
  })

  it('throws when sharing is unavailable', async () => {
    mockIsAvailable.mockResolvedValueOnce(false)

    await expect(
      shareExistingFile({
        dialogTitle: DIALOG,
        fileUri: SRC_URI,
        mimeType: MIME
      })
    ).rejects.toThrow('Sharing is not available on this device')
    expect(mockShare).not.toHaveBeenCalled()
  })

  it('calls Sharing.shareAsync with the provided file URI', async () => {
    mockIsAvailable.mockResolvedValueOnce(true)
    mockShare.mockResolvedValueOnce(undefined)

    await shareExistingFile({
      dialogTitle: DIALOG,
      fileUri: SRC_URI,
      mimeType: MIME
    })

    expect(mockShare).toHaveBeenCalledWith(SRC_URI, {
      dialogTitle: DIALOG,
      mimeType: MIME
    })
  })
})

describe('saveExistingFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'ios'
  })

  it('falls back to share-sheet on iOS', async () => {
    mockIsAvailable.mockResolvedValueOnce(true)
    mockShare.mockResolvedValueOnce(undefined)

    const didSave = await saveExistingFile({
      dialogTitle: DIALOG,
      filename: FILENAME,
      mimeType: MIME,
      srcUri: SRC_URI
    })

    expect(didSave).toBe(true)
    expect(mockSaveDocument).not.toHaveBeenCalled()
    expect(mockShare).toHaveBeenCalledWith(SRC_URI, {
      dialogTitle: DIALOG,
      mimeType: MIME
    })
  })

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android'
    })

    it('writes the file through the native save-as picker', async () => {
      mockReadAsString.mockResolvedValueOnce('base64data')
      mockSaveDocument.mockResolvedValueOnce(true)

      const didSave = await saveExistingFile({
        dialogTitle: DIALOG,
        filename: FILENAME,
        mimeType: MIME,
        srcUri: SRC_URI
      })

      expect(didSave).toBe(true)
      expect(mockSaveDocument).toHaveBeenCalledWith(
        FILENAME,
        MIME,
        'base64data',
        'base64'
      )
      expect(mockWriteAsString).not.toHaveBeenCalled()
      expect(mockShare).not.toHaveBeenCalled()
    })

    it('does not share when the save-as picker is cancelled', async () => {
      mockReadAsString.mockResolvedValueOnce('base64data')
      mockSaveDocument.mockResolvedValueOnce(false)

      const didSave = await saveExistingFile({
        dialogTitle: DIALOG,
        filename: FILENAME,
        mimeType: MIME,
        srcUri: SRC_URI
      })

      expect(didSave).toBe(false)
      expect(mockShare).not.toHaveBeenCalled()
    })
  })
})

describe('saveFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
  })

  it('writes UTF-8 content through the native save-as picker', async () => {
    mockSaveDocument.mockResolvedValueOnce(true)

    const didSave = await saveFile({
      dialogTitle: 'Backup data',
      fileContent: '{"v":1}',
      filename: 'satsigner-backup.json',
      mimeType: 'application/json'
    })

    expect(didSave).toBe(true)
    expect(mockSaveDocument).toHaveBeenCalledWith(
      'satsigner-backup.json',
      'application/json',
      '{"v":1}',
      'utf8'
    )
    expect(mockWriteAsString).not.toHaveBeenCalled()
    expect(mockShare).not.toHaveBeenCalled()
  })
})
