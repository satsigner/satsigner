import type { NostrSignRequest } from '@/types/models/Nostr'
import {
  buildSignBatchView,
  getSignBatchState,
  isHighRiskKind,
  summarizeSignRequest
} from '@/utils/nip46EventSummary'

const RELEASE_CERT =
  'E0:D6:E6:92:FA:D1:AA:16:26:FF:54:9A:CE:E3:47:C2:EB:CE:8B:E5:0D:07:44:CB:D0:D3:A6:75:39:F2:7E:D7'

function request(overrides: Partial<NostrSignRequest> = {}): NostrSignRequest {
  return {
    answered: false,
    expiresAt: 2000,
    identityNpub: 'npub1me',
    messageId: 'm',
    method: 'sign_event',
    params: [],
    peerPubkey: 'peer',
    requestId: '1',
    requestedAt: 1000,
    sessionId: '',
    status: 'pending',
    ...overrides
  }
}

function signEvent(kind: number, tags: string[][], content = '') {
  return request({
    params: [JSON.stringify({ content, created_at: 1000, kind, tags })]
  })
}

describe('summarizeSignRequest', () => {
  it('describes a Zapstore release', () => {
    expect(
      summarizeSignRequest(
        signEvent(30_063, [
          ['i', 'com.satsigner.satsigner'],
          ['version', '1.4.0'],
          ['c', 'main']
        ])
      )
    ).toMatchObject({
      lines: [
        { value: 'com.satsigner.satsigner' },
        { value: '1.4.0' },
        { value: 'main' },
        { label: 'Dated' }
      ],
      risk: 'normal'
    })
  })

  it('accepts a Satsigner file signed with the release certificate', () => {
    const summary = summarizeSignRequest(
      signEvent(3063, [
        ['i', 'com.satsigner.satsigner'],
        ['apk_certificate_hash', RELEASE_CERT]
      ])
    )

    expect(summary.warning).toBeUndefined()
  })

  it('warns about a Satsigner file signed with another certificate', () => {
    const summary = summarizeSignRequest(
      signEvent(3063, [
        ['i', 'com.satsigner.satsigner'],
        ['apk_certificate_hash', 'ab'.repeat(32)]
      ])
    )

    expect(summary.warning).toBeDefined()
  })

  it('does not judge certificates of other apps', () => {
    expect(
      summarizeSignRequest(
        signEvent(3063, [
          ['i', 'com.example.app'],
          ['apk_certificate_hash', 'ab'.repeat(32)]
        ])
      ).warning
    ).toBeUndefined()
  })

  it('flags profile, follows, deletions and lists as high risk', () => {
    for (const kind of [0, 3, 5, 10_002, 10_050]) {
      expect(summarizeSignRequest(signEvent(kind, [])).risk).toBe('high')
    }
    expect(summarizeSignRequest(signEvent(1, [])).risk).toBe('normal')
  })

  it('flags decryption as high risk and names the counterparty', () => {
    expect(
      summarizeSignRequest(
        request({ method: 'nip44_decrypt', params: ['peer-key', 'x'] })
      )
    ).toMatchObject({ lines: [{ value: 'peer-key' }], risk: 'high' })
  })

  it('treats relay auth as high risk', () => {
    expect(isHighRiskKind(22_242)).toBe(true)
    expect(isHighRiskKind(32_267)).toBe(false)
  })
})

describe('batch state', () => {
  it('is pending, then decided, then answered', () => {
    expect(getSignBatchState([request()], 1500)).toBe('pending')
    expect(getSignBatchState([request({ status: 'signed' })], 1500)).toBe(
      'decided'
    )
    expect(
      getSignBatchState([request({ answered: true, status: 'signed' })], 1500)
    ).toBe('answered')
  })

  it('expires a pending batch past its time', () => {
    expect(getSignBatchState([request()], 2000)).toBe('expired')
    expect(getSignBatchState([request({ status: 'expired' })], 1500)).toBe(
      'expired'
    )
  })

  it('is invalid when nothing in it can be signed', () => {
    expect(
      getSignBatchState(
        [request({ error: 'wrong key', status: 'invalid' })],
        1500
      )
    ).toBe('invalid')
  })

  it('is high risk when any request is', () => {
    const view = buildSignBatchView(
      [signEvent(1, []), signEvent(0, [], '{}')],
      1500
    )

    expect(view.highRisk).toBe(true)
    expect(view.items).toHaveLength(2)
  })
})
