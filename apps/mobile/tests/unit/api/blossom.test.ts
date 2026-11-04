import { generateSecretKey, nip19 } from 'nostr-tools'

import { listBlossomFiles } from '@/api/blossom'

jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

const SERVER_URL = 'https://blossom.example'
const PUBKEY_HEX = 'a'.repeat(64)
const BLOB_HASH = 'b'.repeat(64)

const blob = {
  sha256: BLOB_HASH,
  size: 1024,
  type: 'image/png',
  uploaded: 1_700_000_000,
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

  it('signs the first list request when the identity has an nsec', async () => {
    mockFetchOnce(JSON.stringify([blob]))
    const nsec = nip19.nsecEncode(generateSecretKey())

    await expect(
      listBlossomFiles(SERVER_URL, PUBKEY_HEX, nsec)
    ).resolves.toStrictEqual([blob])

    const [, init] = jest.mocked(global.fetch).mock.lastCall ?? []
    const authorization = new Headers(init?.headers).get('Authorization') ?? ''
    const authEvent = JSON.parse(
      Buffer.from(authorization.replace('Nostr ', ''), 'base64').toString()
    )
    expect(authEvent.tags).toContainEqual(['server', 'blossom.example'])
    expect(authEvent.tags).toContainEqual(['t', 'list'])
  })

  it('sends no auth without an nsec or over plain http', async () => {
    const nsec = nip19.nsecEncode(generateSecretKey())

    mockFetchOnce(JSON.stringify([blob]))
    await listBlossomFiles(SERVER_URL, PUBKEY_HEX)
    const [, withoutNsec] = jest.mocked(global.fetch).mock.lastCall ?? []
    expect(new Headers(withoutNsec?.headers).has('Authorization')).toBe(false)

    mockFetchOnce(JSON.stringify([blob]))
    await listBlossomFiles('http://blossom.example', PUBKEY_HEX, nsec)
    const [, overHttp] = jest.mocked(global.fetch).mock.lastCall ?? []
    expect(new Headers(overHttp?.headers).has('Authorization')).toBe(false)
  })
})
