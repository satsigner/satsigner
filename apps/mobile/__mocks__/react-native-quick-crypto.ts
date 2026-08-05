import * as nodeCrypto from 'node:crypto'

const mockCipherUpdate = jest.fn().mockReturnValue(Buffer.alloc(16))
const mockCipherFinal = jest.fn().mockReturnValue(Buffer.alloc(0))

const QuickCrypto = {
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
    .mockImplementation((size: number) => nodeCrypto.randomBytes(size))
}

export default QuickCrypto
