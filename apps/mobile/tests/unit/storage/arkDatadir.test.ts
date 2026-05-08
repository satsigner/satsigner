import * as FileSystem from 'expo-file-system/legacy'

import { findArkDbFile } from '@/storage/arkDatadir'

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    deleteAsync: jest.fn(),
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    readDirectoryAsync: jest.fn()
  })
)

const mockGetInfo = jest.mocked(FileSystem.getInfoAsync)
const mockReadDir = jest.mocked(FileSystem.readDirectoryAsync)

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
