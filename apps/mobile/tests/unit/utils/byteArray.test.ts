import { bytesEqual } from '@/utils/byteArray'

describe('bytesEqual', () => {
  it('matches arrays with the same bytes', () => {
    expect(
      bytesEqual(new Uint8Array([0, 20, 255]), new Uint8Array([0, 20, 255]))
    ).toBe(true)
  })

  it('matches a Buffer against a plain Uint8Array', () => {
    expect(
      bytesEqual(Buffer.from('0014ab', 'hex'), new Uint8Array([0, 20, 171]))
    ).toBe(true)
  })

  it('matches two empty arrays', () => {
    expect(bytesEqual(new Uint8Array(), new Uint8Array())).toBe(true)
  })

  it('rejects arrays of different lengths', () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(
      false
    )
  })

  it('rejects arrays that differ in one byte', () => {
    expect(
      bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))
    ).toBe(false)
  })
})
