const mockCipherUpdate = jest.fn().mockReturnValue(new ArrayBuffer(16))
const mockCipherFinal = jest.fn().mockReturnValue(new ArrayBuffer(0))

const QuickCrypto = {
  createCipheriv: jest.fn().mockReturnValue({
    final: mockCipherFinal,
    update: mockCipherUpdate
  }),
  createDecipheriv: jest.fn().mockReturnValue({
    final: jest.fn().mockReturnValue(new ArrayBuffer(0)),
    update: jest.fn().mockReturnValue(new ArrayBuffer(16))
  }),
  createHash: jest.fn().mockImplementation(() => {
    let data = ''
    return {
      digest: jest.fn().mockImplementation(() => {
        const buf = Buffer.alloc(32)
        for (let i = 0; i < 32; i += 1) {
          buf[i] = data.charCodeAt(i % data.length) ^ (i * 31)
        }
        return buf
      }),
      update: jest.fn().mockImplementation(function updateHash(
        this: unknown,
        input: string
      ) {
        data += String(input)
        return this
      })
    }
  }),
  pbkdf2Sync: jest.fn().mockReturnValue(new ArrayBuffer(32)),
  randomBytes: jest.fn().mockImplementation((size: number) => {
    const buf = new ArrayBuffer(size)
    const view = new Uint8Array(buf)
    for (let i = 0; i < size; i += 1) {
      view[i] = Math.floor(Math.random() * 256)
    }
    return buf
  })
}

export default QuickCrypto
