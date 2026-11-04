import { getAndroidVersionCode } from '@/constants/versionCode.cjs'

describe('getAndroidVersionCode', () => {
  it('derives the code from major, minor and patch', () => {
    expect(getAndroidVersionCode('0.3.7')).toBe(3007)
    expect(getAndroidVersionCode('1.0.0')).toBe(1_000_000)
    expect(getAndroidVersionCode('2.12.999')).toBe(2_012_999)
  })

  it('rises with every release', () => {
    const releases = ['0.3.6', '0.3.7', '0.3.10', '0.4.0', '1.0.0', '1.0.1']
    const codes = releases.map(getAndroidVersionCode)
    expect(codes).toStrictEqual([...codes].toSorted((a, b) => a - b))
    expect(new Set(codes).size).toBe(releases.length)
  })

  it('rejects versions it cannot encode', () => {
    expect(() => getAndroidVersionCode('0.3')).toThrow('major.minor.patch')
    expect(() => getAndroidVersionCode('0.3.7-beta')).toThrow(
      'major.minor.patch'
    )
    expect(() => getAndroidVersionCode('0.1000.0')).toThrow('1000 or more')
  })
})
