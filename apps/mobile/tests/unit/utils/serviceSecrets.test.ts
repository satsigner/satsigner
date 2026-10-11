import {
  getLndConfigSecret,
  getRpcCredentialsSecret,
  storeLndConfigSecret,
  storeRpcCredentialsSecret
} from '@/storage/encrypted'
import { aesDecrypt, aesReEncrypt } from '@/utils/crypto'
import {
  loadLndSecrets,
  loadRpcCredentials,
  reEncryptServiceSecrets
} from '@/utils/serviceSecrets'

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  ...jest.requireActual<typeof import('@/utils/crypto')>('@/utils/crypto'),
  aesDecrypt: jest.fn(),
  aesReEncrypt: jest.fn()
}))

const PIN = 'pin-digest'

describe('loadLndSecrets', () => {
  it('returns the decrypted cert and macaroon', async () => {
    await storeLndConfigSecret('ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(JSON.stringify({ cert: 'MIIB', macaroon: 'aa' }))

    await expect(loadLndSecrets(PIN)).resolves.toStrictEqual({
      cert: 'MIIB',
      macaroon: 'aa'
    })
  })

  it('loads a legacy pairing that stored no cert with an empty cert', async () => {
    await storeLndConfigSecret('ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(JSON.stringify({ macaroon: 'aa' }))

    await expect(loadLndSecrets(PIN)).resolves.toStrictEqual({
      cert: '',
      macaroon: 'aa'
    })
  })

  it('treats a decrypted payload with the wrong shape as missing', async () => {
    await storeLndConfigSecret('ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(JSON.stringify({ macaroon: 42 }))

    await expect(loadLndSecrets(PIN)).resolves.toBeNull()
  })
})

describe('loadRpcCredentials', () => {
  it('returns the decrypted credentials', async () => {
    await storeRpcCredentialsSecret('signet', 'ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(
        JSON.stringify({ password: 'secret', username: 'satoshi' })
      )

    await expect(loadRpcCredentials('signet', PIN)).resolves.toStrictEqual({
      password: 'secret',
      username: 'satoshi'
    })
  })

  it('treats a decrypted payload with the wrong shape as missing', async () => {
    await storeRpcCredentialsSecret('signet', 'ciphertext', 'iv')
    jest.mocked(aesDecrypt).mockResolvedValueOnce('null')

    await expect(loadRpcCredentials('signet', PIN)).resolves.toBeNull()
  })
})

describe('reEncryptServiceSecrets', () => {
  it('moves every stored secret to the new PIN as stored', async () => {
    await storeLndConfigSecret('lnd-ciphertext', 'lnd-iv')
    await storeRpcCredentialsSecret('signet', 'rpc-ciphertext', 'rpc-iv')
    jest.mocked(aesReEncrypt).mockImplementation((stored) =>
      Promise.resolve({
        iv: `${stored.iv}-new`,
        secret: `${stored.secret}-new`
      })
    )

    await reEncryptServiceSecrets(PIN, 'new-pin')

    expect(aesReEncrypt).toHaveBeenCalledWith(
      { iv: 'lnd-iv', secret: 'lnd-ciphertext' },
      PIN,
      'new-pin'
    )
    await expect(getLndConfigSecret()).resolves.toStrictEqual({
      iv: 'lnd-iv-new',
      secret: 'lnd-ciphertext-new'
    })
    await expect(getRpcCredentialsSecret('signet')).resolves.toStrictEqual({
      iv: 'rpc-iv-new',
      secret: 'rpc-ciphertext-new'
    })
  })
})
