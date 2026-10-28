import * as FileSystem from 'expo-file-system/legacy'

import {
  deleteArkDatadir,
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
    moveAsync: jest.fn(),
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
const mockDelete = jest.mocked(FileSystem.deleteAsync)
const mockMove = jest.mocked(FileSystem.moveAsync)

const LIVE_URI = 'file:///doc/ark/acc-1/'
const STAGING_URI = 'file:///doc/ark-swap/acc-1/staging/'
const PREVIOUS_URI = 'file:///doc/ark-swap/acc-1/previous/'
const BARK_DB_FILES = [{ base64: 'ZGItbWFpbg==', filename: 'bark.db' }]

function fakeDirectories(
  initial: Record<string, string>,
  failingMoveSources: string[] = []
) {
  const dirs = new Map(Object.entries(initial))
  mockGetInfo.mockImplementation((uri) =>
    Promise.resolve({ exists: dirs.has(uri) })
  )
  mockMkdir.mockImplementation((uri) => {
    dirs.set(uri, 'staged')
    return Promise.resolve()
  })
  mockDelete.mockImplementation((uri) => {
    for (const dir of dirs.keys()) {
      if (dir.startsWith(uri)) {
        dirs.delete(dir)
      }
    }
    return Promise.resolve()
  })
  mockMove.mockImplementation(({ from, to }) => {
    const contents = dirs.get(from)
    if (failingMoveSources.includes(from) || contents === undefined) {
      return Promise.reject(new Error(`move failed: ${from}`))
    }
    dirs.delete(from)
    dirs.set(to, contents)
    return Promise.resolve()
  })
  return dirs
}

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
    mockDelete.mockResolvedValue(undefined)
    mockMove.mockResolvedValue(undefined)
    mockMkdir.mockResolvedValue(undefined)
    mockWriteAsString.mockResolvedValue(undefined)
  })

  it('creates an empty datadir when there are no files', async () => {
    await writeArkDatadirFiles('acc-1', [])

    expect(mockMkdir).toHaveBeenCalledWith('file:///doc/ark/acc-1/', {
      intermediates: true
    })
    expect(mockWriteAsString).not.toHaveBeenCalled()
  })

  it('writes sqlite files into a staging datadir then replaces the target', async () => {
    mockGetInfo.mockResolvedValue({ exists: false })

    await writeArkDatadirFiles('acc-1', [
      { base64: 'ZGItbWFpbg==', filename: 'bark.db' }
    ])

    expect(mockWriteAsString).toHaveBeenCalledWith(
      'file:///doc/ark-swap/acc-1/staging/bark.db',
      'ZGItbWFpbg==',
      { encoding: 'base64' }
    )
    expect(mockMove).toHaveBeenCalledWith({
      from: 'file:///doc/ark-swap/acc-1/staging/',
      to: 'file:///doc/ark/acc-1/'
    })
  })

  it('rejects unsafe filenames without deleting the existing datadir', async () => {
    await expect(
      writeArkDatadirFiles('acc-1', [
        { base64: 'eA==', filename: '../escape.db' }
      ])
    ).rejects.toThrow('Invalid ark datadir file')
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockWriteAsString).not.toHaveBeenCalled()
  })

  it('swaps the staged datadir in and leaves no staging or previous dirs', async () => {
    const dirs = fakeDirectories({ [LIVE_URI]: 'live' })

    await writeArkDatadirFiles('acc-1', BARK_DB_FILES)

    expect(Object.fromEntries(dirs)).toStrictEqual({ [LIVE_URI]: 'staged' })
  })

  it('restores the previous datadir when moving staging into place fails', async () => {
    const dirs = fakeDirectories({ [LIVE_URI]: 'live' }, [STAGING_URI])

    await expect(writeArkDatadirFiles('acc-1', BARK_DB_FILES)).rejects.toThrow(
      `move failed: ${STAGING_URI}`
    )
    expect(Object.fromEntries(dirs)).toStrictEqual({ [LIVE_URI]: 'live' })
  })

  it('keeps the previous datadir when it cannot be moved back', async () => {
    const dirs = fakeDirectories({ [LIVE_URI]: 'live' }, [
      STAGING_URI,
      PREVIOUS_URI
    ])

    await expect(writeArkDatadirFiles('acc-1', BARK_DB_FILES)).rejects.toThrow(
      `move failed: ${PREVIOUS_URI}`
    )
    expect(dirs.get(PREVIOUS_URI)).toBe('live')
  })

  it('leaves the live datadir untouched when staging a file fails', async () => {
    const dirs = fakeDirectories({ [LIVE_URI]: 'live' })
    mockWriteAsString.mockRejectedValueOnce(new Error('disk full'))

    await expect(writeArkDatadirFiles('acc-1', BARK_DB_FILES)).rejects.toThrow(
      'disk full'
    )
    expect(Object.fromEntries(dirs)).toStrictEqual({ [LIVE_URI]: 'live' })
  })

  it('creates the datadir from staging when no live datadir exists', async () => {
    const dirs = fakeDirectories({})

    await writeArkDatadirFiles('acc-1', BARK_DB_FILES)

    expect(Object.fromEntries(dirs)).toStrictEqual({ [LIVE_URI]: 'staged' })
  })

  it('leaves accounts whose ids end in .staging or .previous untouched', async () => {
    const dirs = fakeDirectories({
      [LIVE_URI]: 'live',
      'file:///doc/ark/acc-1.previous/': 'other account',
      'file:///doc/ark/acc-1.staging/': 'other account'
    })

    await writeArkDatadirFiles('acc-1', BARK_DB_FILES)

    expect(Object.fromEntries(dirs)).toStrictEqual({
      [LIVE_URI]: 'staged',
      'file:///doc/ark/acc-1.previous/': 'other account',
      'file:///doc/ark/acc-1.staging/': 'other account'
    })
  })
})

describe('deleteArkDatadir', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('removes the live datadir and any leftover restore copies', async () => {
    const dirs = fakeDirectories({
      [LIVE_URI]: 'live',
      [PREVIOUS_URI]: 'older',
      [STAGING_URI]: 'staged'
    })

    await deleteArkDatadir('acc-1')

    expect(Object.fromEntries(dirs)).toStrictEqual({})
  })
})
