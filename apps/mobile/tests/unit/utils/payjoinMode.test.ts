import {
  PAYJOIN_DEFAULT_COORDINATION_MODE,
  PAYJOIN_DIRECTORY_URL
} from '@/constants/payjoin'
import {
  hasCustomPayjoinDirectoryUrl,
  isPayjoinCoordinationMode,
  normalizePayjoinCoordinationMode,
  PAYJOIN_COORDINATION_MODES,
  resolvePayjoinDirectoryUrl
} from '@/utils/payjoinMode'

describe('payjoinMode', () => {
  it('recognizes only known coordination modes', () => {
    expect(isPayjoinCoordinationMode('directory')).toBe(true)
    expect(isPayjoinCoordinationMode('manual')).toBe(true)
    expect(isPayjoinCoordinationMode('offline')).toBe(false)
    expect(isPayjoinCoordinationMode(undefined)).toBe(false)
    expect(isPayjoinCoordinationMode(42)).toBe(false)
  })

  it('normalizes unknown values to the default mode', () => {
    expect(normalizePayjoinCoordinationMode('manual')).toBe('manual')
    expect(normalizePayjoinCoordinationMode('directory')).toBe('directory')
    expect(normalizePayjoinCoordinationMode('nonsense')).toBe(
      PAYJOIN_DEFAULT_COORDINATION_MODE
    )
    expect(normalizePayjoinCoordinationMode(undefined)).toBe(
      PAYJOIN_DEFAULT_COORDINATION_MODE
    )
  })

  it('defaults to directory (interop) mode', () => {
    expect(PAYJOIN_DEFAULT_COORDINATION_MODE).toBe('directory')
    expect(PAYJOIN_COORDINATION_MODES).toStrictEqual(['directory', 'manual'])
  })

  it('falls back to the default directory when no custom url is set', () => {
    expect(resolvePayjoinDirectoryUrl(undefined)).toBe(PAYJOIN_DIRECTORY_URL)
    expect(resolvePayjoinDirectoryUrl('')).toBe(PAYJOIN_DIRECTORY_URL)
    expect(resolvePayjoinDirectoryUrl('   ')).toBe(PAYJOIN_DIRECTORY_URL)
  })

  it('uses a custom directory url and trims trailing slashes/whitespace', () => {
    expect(resolvePayjoinDirectoryUrl('https://pj.example.com')).toBe(
      'https://pj.example.com'
    )
    expect(resolvePayjoinDirectoryUrl('  https://pj.example.com/  ')).toBe(
      'https://pj.example.com'
    )
    expect(resolvePayjoinDirectoryUrl('https://pj.example.com///')).toBe(
      'https://pj.example.com'
    )
  })

  it('detects whether a custom directory url is present', () => {
    expect(hasCustomPayjoinDirectoryUrl(undefined)).toBe(false)
    expect(hasCustomPayjoinDirectoryUrl('')).toBe(false)
    expect(hasCustomPayjoinDirectoryUrl('   ')).toBe(false)
    expect(hasCustomPayjoinDirectoryUrl('https://pj.example.com')).toBe(true)
  })
})
