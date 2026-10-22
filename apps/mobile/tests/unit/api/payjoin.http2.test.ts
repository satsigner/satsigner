import { isHttp2PrefaceError } from '@/api/payjoin'

describe('isHttp2PrefaceError', () => {
  it.each([
    'Expected a SETTINGS frame but was 4',
    'Required SETTINGS preface not received',
    'stream was reset: HTTP2 PROTOCOL_ERROR',
    'unexpected http/2 response',
    'TYPE_SETTINGS length % 6 != 0: 7',
    'PROTOCOL_ERROR SETTINGS_MAX_FRAME_SIZE: 1'
  ])('treats "%s" as an HTTP/2 handshake failure', (message) => {
    expect(isHttp2PrefaceError(new Error(message))).toBe(true)
  })

  it.each([
    'Invalid wallet settings',
    'settings: missing value',
    'Network request failed'
  ])('ignores unrelated error "%s"', (message) => {
    expect(isHttp2PrefaceError(new Error(message))).toBe(false)
  })
})
