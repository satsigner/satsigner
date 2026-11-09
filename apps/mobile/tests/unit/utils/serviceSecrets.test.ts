import {
  storeLndConfigSecret,
  storeRpcCredentialsSecret
} from '@/storage/encrypted'
import { aesDecrypt } from '@/utils/crypto'
import { loadLndSecrets, loadRpcCredentials } from '@/utils/serviceSecrets'

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  ...jest.requireActual<typeof import('@/utils/crypto')>('@/utils/crypto'),
  aesDecrypt: jest.fn()
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
