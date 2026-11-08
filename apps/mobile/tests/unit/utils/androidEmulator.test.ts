import { isAndroidEmulatorBuild } from '@/utils/androidEmulator'

describe('isAndroidEmulatorBuild', () => {
  it('recognises the stock Android emulator', () => {
    expect(
      isAndroidEmulatorBuild({
        Brand: 'google',
        Fingerprint:
          'google/sdk_gphone64_arm64/emu64a:14/UE1A.230829.036/10984587:userdebug/dev-keys',
        Manufacturer: 'Google',
        Model: 'sdk_gphone64_arm64'
      })
    ).toBe(true)
    expect(
      isAndroidEmulatorBuild({
        Fingerprint: 'generic/sdk/generic:9/PSR1/1:user/release-keys',
        Model: 'Android SDK built for x86'
      })
    ).toBe(true)
  })

  it('recognises Genymotion', () => {
    expect(
      isAndroidEmulatorBuild({ Manufacturer: 'Genymotion', Model: 'Pixel 3' })
    ).toBe(true)
  })

  it('treats a real phone as a device', () => {
    expect(
      isAndroidEmulatorBuild({
        Brand: 'google',
        Fingerprint:
          'google/tokay/tokay:15/AP4A.250205.002/12847562:user/release-keys',
        Manufacturer: 'Google',
        Model: 'Pixel 9'
      })
    ).toBe(false)
  })
})
