import {
  classifyHost,
  formatDiagnosticsReport,
  redactLine,
  redactUrl
} from '@/utils/diagnostics/redact'

const NPUB = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m'
const HEX = 'a'.repeat(64)

describe('diagnostics redaction', () => {
  it('classifies hosts', () => {
    expect(classifyHost('abcdef.onion')).toBe('onion')
    expect(classifyHost('192.168.1.20')).toBe('private')
    expect(classifyHost('localhost')).toBe('localhost')
    expect(classifyHost('relay.damus.io')).toBe('public')
  })

  it('keeps only the scheme and host class of urls', () => {
    expect(redactUrl('wss://relay.example.com/path')).toBe('wss://[public]')
    expect(redactUrl('tcp://user:pw@192.168.1.5:50001')).toBe('tcp://[private]')
    expect(redactUrl('http://abc.onion:8080')).toBe('http://[onion]')
  })

  it('removes npubs, hex ids, addresses and extended keys', () => {
    const line = `peer ${NPUB} event ${HEX} to bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq and tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx`
    const redacted = redactLine(line)

    expect(redacted).not.toContain(NPUB)
    expect(redacted).not.toContain(HEX)
    expect(redacted).not.toContain('bc1qar0')
    expect(redacted).not.toContain('tb1qw508')
    expect(redacted).toContain('npub1[…]')
  })

  it('redacts bare ipv6 addresses', () => {
    const address = '2001:db8:85a3::8a2e:370:7334'
    expect(redactLine(`connect ${address} refused`)).toBe(
      'connect [ip] refused'
    )
    expect(redactLine(`connect ${address} refused`)).not.toContain(address)
  })

  it('formats a redacted plain-text report', () => {
    const text = formatDiagnosticsReport(
      [
        {
          category: 'nostr',
          durationMs: 12,
          id: 'nostrRelays',
          lines: ['wss://my.private.relay.example: EOSE 120ms'],
          status: 'warn'
        }
      ],
      ['Diagnostics']
    )

    expect(text).toContain('[WARN] nostr/nostrRelays (12ms)')
    expect(text).toContain('wss://[public]: EOSE 120ms')
    expect(text).not.toContain('my.private.relay')
  })
})
