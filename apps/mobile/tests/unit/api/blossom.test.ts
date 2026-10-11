import { listBlossomFiles } from '@/api/blossom'

const SERVER_URL = 'https://blossom.example'
const PUBKEY_HEX = 'a'.repeat(64)
const BLOB_HASH = 'b'.repeat(64)

const blob = {
  sha256: BLOB_HASH,
  size: 1024,
  type: 'image/png',
  uploaded: 1700000000,
  url: `${SERVER_URL}/${BLOB_HASH}.png`
}

function mockFetchOnce(body: string) {
  jest.mocked(global.fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body)
  })
}

describe('listBlossomFiles', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('keeps only the entries that have a url and sha256', async () => {
    mockFetchOnce(
      JSON.stringify([
        { ...blob, nip94: [['url', blob.url]] },
        { url: blob.url },
        { sha256: BLOB_HASH },
        null
      ])
    )

    await expect(
      listBlossomFiles(SERVER_URL, PUBKEY_HEX)
    ).resolves.toStrictEqual([blob])
  })

  it('keeps a file whose optional fields are missing or unreadable', async () => {
    mockFetchOnce(
      JSON.stringify([
        {
          name: null,
          sha256: BLOB_HASH,
          size: '1024',
          type: null,
          url: blob.url
        }
      ])
    )

    await expect(
      listBlossomFiles(SERVER_URL, PUBKEY_HEX)
    ).resolves.toStrictEqual([
      {
        name: undefined,
        sha256: BLOB_HASH,
        size: 0,
        type: undefined,
        url: blob.url
      }
    ])
  })

  it('returns an empty list when the body is not a list', async () => {
    mockFetchOnce(JSON.stringify({ files: [blob] }))
    await expect(
      listBlossomFiles(SERVER_URL, PUBKEY_HEX)
    ).resolves.toStrictEqual([])

    mockFetchOnce('not json')
    await expect(
      listBlossomFiles(SERVER_URL, PUBKEY_HEX)
    ).resolves.toStrictEqual([])
  })
})
