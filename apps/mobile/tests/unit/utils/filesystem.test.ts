import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

import { saveExistingFile, shareExistingFile } from '@/utils/filesystem'

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    EncodingType: { Base64: 'base64', UTF8: 'utf8' },
    StorageAccessFramework: {
      createFileAsync: jest.fn(),
      requestDirectoryPermissionsAsync: jest.fn()
    },
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
const mockRequestPerms = jest.mocked(
  FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync
)
const mockCreateFile = jest.mocked(
  FileSystem.StorageAccessFramework.createFileAsync
)

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

    await saveExistingFile({
      dialogTitle: DIALOG,
      filename: FILENAME,
      mimeType: MIME,
      srcUri: SRC_URI
    })

    expect(mockRequestPerms).not.toHaveBeenCalled()
    expect(mockShare).toHaveBeenCalledWith(SRC_URI, {
      dialogTitle: DIALOG,
      mimeType: MIME
    })
  })

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android'
    })

    it('writes file to chosen folder via SAF when permissions granted', async () => {
      const dirUri = 'content://saf/picked-folder'
      const destUri = 'content://saf/picked-folder/bark.db'
      mockRequestPerms.mockResolvedValueOnce({
        directoryUri: dirUri,
        granted: true
      })
      mockCreateFile.mockResolvedValueOnce(destUri)
      mockReadAsString.mockResolvedValueOnce('base64data')
      mockWriteAsString.mockResolvedValueOnce(undefined)

      await saveExistingFile({
        dialogTitle: DIALOG,
        filename: FILENAME,
        mimeType: MIME,
        srcUri: SRC_URI
      })

      expect(mockCreateFile).toHaveBeenCalledWith(dirUri, FILENAME, MIME)
      expect(mockReadAsString).toHaveBeenCalledWith(SRC_URI, {
        encoding: 'base64'
      })
      expect(mockWriteAsString).toHaveBeenCalledWith(destUri, 'base64data', {
        encoding: 'base64'
      })
      expect(mockShare).not.toHaveBeenCalled()
    })

    it('falls back to share-sheet when SAF permissions denied', async () => {
      mockRequestPerms.mockResolvedValueOnce({
        directoryUri: null,
        granted: false
      })
      mockIsAvailable.mockResolvedValueOnce(true)
      mockShare.mockResolvedValueOnce(undefined)

      await saveExistingFile({
        dialogTitle: DIALOG,
        filename: FILENAME,
        mimeType: MIME,
        srcUri: SRC_URI
      })

      expect(mockCreateFile).not.toHaveBeenCalled()
      expect(mockWriteAsString).not.toHaveBeenCalled()
      expect(mockShare).toHaveBeenCalledWith(SRC_URI, {
        dialogTitle: DIALOG,
        mimeType: MIME
      })
    })
  })
})
