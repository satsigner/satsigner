import * as nodeCrypto from 'node:crypto'

const mockCipherUpdate = jest.fn().mockReturnValue(Buffer.alloc(16))
const mockCipherFinal = jest.fn().mockReturnValue(Buffer.alloc(0))

const QuickCrypto = {
  // Argon2 has no node:crypto equivalent; scrypt with the parameters folded
  // into the salt gives a deterministic, input- and config-dependent stand-in.
  argon2Sync: jest.fn().mockImplementation(
    (
      _algorithm: string,
      params: {
        memory: number
        message: string
        nonce: string
        parallelism: number
        passes: number
        tagLength: number
      }
    ) =>
      nodeCrypto.scryptSync(
        params.message,
        `${params.nonce}|argon2id|${params.memory}|${params.passes}|${params.parallelism}`,
        params.tagLength
      )
  ),
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
  pbkdf2Sync: jest.fn().mockReturnValue(new ArrayBuffer(32)),
  randomBytes: jest
    .fn()
    .mockImplementation((size: number) => nodeCrypto.randomBytes(size)),
  scryptSync: jest
    .fn()
    .mockImplementation(
      (
        password: string,
        salt: string,
        keylen: number,
        options?: { N?: number; p?: number; r?: number }
      ) =>
        nodeCrypto.scryptSync(password, salt, keylen, {
          ...options,
          maxmem: 256 * 1024 * 1024
        })
    )
}

export default QuickCrypto
