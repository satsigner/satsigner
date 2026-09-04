import * as FileSystem from 'expo-file-system/legacy'

import {
  findArkDbFile,
  readArkDatadirFiles,
  writeArkDatadirFiles
} from '@/storage/arkDatadir'

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    EncodingType: { Base64: 'base64' },
    deleteAsync: jest.fn(),
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
    writeAsStringAsync: jest.fn()
  })
)

const mockGetInfo = jest.mocked(FileSystem.getInfoAsync)
const mockReadDir = jest.mocked(FileSystem.readDirectoryAsync)
const mockReadAsString = jest.mocked(FileSystem.readAsStringAsync)
const mockWriteAsString = jest.mocked(FileSystem.writeAsStringAsync)
const mockMkdir = jest.mocked(FileSystem.makeDirectoryAsync)

describe('findArkDbFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when datadir does not exist', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: false })

    const result = await findArkDbFile('acc-1')

    expect(result).toBeNull()
    expect(mockReadDir).not.toHaveBeenCalled()
  })

  it('returns null when no .db or .sqlite file is present', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: true })
    mockReadDir.mockResolvedValueOnce(['notes.txt', 'config.json'])

    const result = await findArkDbFile('acc-1')

    expect(result).toBeNull()
  })

  it('returns full URI for the main .db file', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: true })
    mockReadDir.mockResolvedValueOnce(['bark.db'])

    const result = await findArkDbFile('acc-1')

    expect(result).toBe('file:///doc/ark/acc-1/bark.db')
  })

  it('filters out -wal, -shm, and -journal sidecar files', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: true })
    mockReadDir.mockResolvedValueOnce([
      'bark.db-wal',
      'bark.db-shm',
      'bark.db-journal',
      'bark.db'
    ])

    const result = await findArkDbFile('acc-1')

    expect(result).toBe('file:///doc/ark/acc-1/bark.db')
  })

  it('returns null when only sidecar files exist', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: true })
    mockReadDir.mockResolvedValueOnce(['bark.db-wal', 'bark.db-shm'])

    const result = await findArkDbFile('acc-1')

    expect(result).toBeNull()
  })

  it('matches .sqlite extension', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: true })
    mockReadDir.mockResolvedValueOnce(['bark.sqlite'])

    const result = await findArkDbFile('acc-1')

    expect(result).toBe('file:///doc/ark/acc-1/bark.sqlite')
  })

  it('queries the correct per-account datadir', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: true })
    mockReadDir.mockResolvedValueOnce(['bark.db'])

    await findArkDbFile('my-account-id')

    expect(mockGetInfo).toHaveBeenCalledWith('file:///doc/ark/my-account-id/')
    expect(mockReadDir).toHaveBeenCalledWith('file:///doc/ark/my-account-id/')
  })
})

describe('readArkDatadirFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns an empty list when the datadir does not exist', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: false })

    await expect(readArkDatadirFiles('acc-1')).resolves.toStrictEqual([])
  })

  it('reads the main db and wal/shm sidecars as base64', async () => {
    mockGetInfo.mockResolvedValueOnce({ exists: true })
    mockReadDir.mockResolvedValueOnce([
      'notes.txt',
      'bark.db',
      'bark.db-wal',
      'bark.db-shm'
    ])
    mockReadAsString
      .mockResolvedValueOnce('ZGItbWFpbg==')
      .mockResolvedValueOnce('ZGItd2Fs')
      .mockResolvedValueOnce('ZGItc2ht')

    const files = await readArkDatadirFiles('acc-1')

    expect(files).toStrictEqual([
      { base64: 'ZGItbWFpbg==', filename: 'bark.db' },
      { base64: 'ZGItd2Fs', filename: 'bark.db-wal' },
      { base64: 'ZGItc2ht', filename: 'bark.db-shm' }
    ])
    expect(mockReadAsString).toHaveBeenCalledWith(
      'file:///doc/ark/acc-1/bark.db',
      { encoding: 'base64' }
    )
  })
})

describe('writeArkDatadirFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetInfo.mockResolvedValue({ exists: false })
  })

  it('creates an empty datadir when there are no files', async () => {
    await writeArkDatadirFiles('acc-1', [])

    expect(mockMkdir).toHaveBeenCalledWith('file:///doc/ark/acc-1/', {
      intermediates: true
    })
    expect(mockWriteAsString).not.toHaveBeenCalled()
  })

  it('writes sqlite files into a fresh datadir', async () => {
    mockGetInfo.mockResolvedValue({ exists: false })

    await writeArkDatadirFiles('acc-1', [
      { base64: 'ZGItbWFpbg==', filename: 'bark.db' }
    ])

    expect(mockWriteAsString).toHaveBeenCalledWith(
      'file:///doc/ark/acc-1/bark.db',
      'ZGItbWFpbg==',
      { encoding: 'base64' }
    )
  })

  it('rejects unsafe filenames', async () => {
    await expect(
      writeArkDatadirFiles('acc-1', [
        { base64: 'eA==', filename: '../escape.db' }
      ])
    ).rejects.toThrow('Invalid ark datadir file')
  })
})
