import * as nodeCrypto from 'node:crypto'

/* oxlint-disable promise/prefer-await-to-callbacks -- native QuickCrypto KDF mocks match the callback API */

const mockCipherUpdate = jest.fn().mockReturnValue(Buffer.alloc(16))
const mockCipherFinal = jest.fn().mockReturnValue(Buffer.alloc(0))

function argon2Impl(
  _algorithm: string,
  params: {
    memory: number
    message: string
    nonce: string
    parallelism: number
    passes: number
    tagLength: number
  }
) {
  return nodeCrypto.scryptSync(
    params.message,
    `${params.nonce}|argon2id|${params.memory}|${params.passes}|${params.parallelism}`,
    params.tagLength
  )
}

function scryptImpl(
  password: string,
  salt: string,
  keylen: number,
  options?: { N?: number; maxmem?: number; p?: number; r?: number }
) {
  return nodeCrypto.scryptSync(password, salt, keylen, {
    ...options,
    maxmem: options?.maxmem ?? 256 * 1024 * 1024
  })
}

function pbkdf2Impl(
  password: string,
  salt: string,
  iterations: number,
  keylen: number,
  digest: string
) {
  return nodeCrypto.pbkdf2Sync(password, salt, iterations, keylen, digest)
}

const QuickCrypto = {
  // Argon2 has no node:crypto equivalent; scrypt with the parameters folded
  // into the salt gives a deterministic, input- and config-dependent stand-in.
  argon2: jest
    .fn()
    .mockImplementation(
      (
        algorithm: string,
        params: Parameters<typeof argon2Impl>[1],
        callback: (err: Error | null, result: Buffer) => void
      ) => {
        callback(null, argon2Impl(algorithm, params))
      }
    ),
  argon2Sync: jest.fn().mockImplementation(argon2Impl),
  createCipheriv: jest.fn().mockReturnValue({
    final: mockCipherFinal,
    update: mockCipherUpdate
  }),
  createDecipheriv: jest.fn().mockReturnValue({
    final: jest.fn().mockReturnValue(Buffer.alloc(0)),
    update: jest.fn().mockReturnValue(Buffer.alloc(16))
  }),
  // Backed by node:crypto so digests are real. Entropy conditioning depends on
  // actual hash behaviour (avalanche, full digest width), which a stub cannot model.
  createHash: jest.fn().mockImplementation((algorithm: string) => {
    const hash = nodeCrypto.createHash(algorithm)
    return {
      digest: jest.fn().mockImplementation(() => hash.digest()),
      update: jest.fn().mockImplementation(function updateHash(
        this: unknown,
        input: string
      ) {
        hash.update(String(input))
        return this
      })
    }
  }),
  pbkdf2: jest
    .fn()
    .mockImplementation(
      (
        password: string,
        salt: string,
        iterations: number,
        keylen: number,
        digest: string,
        callback: (err: Error | null, result?: Buffer) => void
      ) => {
        callback(null, pbkdf2Impl(password, salt, iterations, keylen, digest))
      }
    ),
  pbkdf2Sync: jest.fn().mockImplementation(pbkdf2Impl),
  randomBytes: jest
    .fn()
    .mockImplementation((size: number) => nodeCrypto.randomBytes(size)),
  scrypt: jest
    .fn()
    .mockImplementation(
      (
        password: string,
        salt: string,
        keylen: number,
        options: Parameters<typeof scryptImpl>[3],
        callback: (err: Error | null, result?: Buffer) => void
      ) => {
        callback(null, scryptImpl(password, salt, keylen, options))
      }
    ),
  scryptSync: jest.fn().mockImplementation(scryptImpl)
}

export default QuickCrypto
