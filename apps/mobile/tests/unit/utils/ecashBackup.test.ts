import { type EcashMint, type EcashProof } from '@/types/models/Ecash'
import {
  buildEcashBackupPayload,
  collectMintUrlsForRestore,
  EcashBackupValidationError,
  normalizeRestoredProofs,
  parseEcashBackupPayload
} from '@/utils/ecashBackup'

function proof(secret: string, mintUrl: string): EcashProof {
  return { C: `C-${secret}`, amount: 1, id: 'ks', mintUrl, secret }
}

function mint(url: string): EcashMint {
  return {
    balance: 1,
    isConnected: true,
    keysets: [],
    url
  }
}

describe('ecash backup', () => {
  it('always exports every mint on the account', () => {
    const payload = buildEcashBackupPayload({
      accountId: 'acc-1',
      includeMintInformation: false,
      includeTokenProofs: true,
      includeTransactionHistory: false,
      mints: [mint('https://a.example'), mint('https://b.example')],
      proofs: [
        proof('s1', 'https://a.example'),
        proof('s2', 'https://b.example')
      ],
      transactions: []
    })

    expect(payload.accountId).toBe('acc-1')
    expect(payload.mints).toHaveLength(2)
    expect(payload.mints?.map((item) => item.url)).toStrictEqual([
      'https://a.example',
      'https://b.example'
    ])
    expect(payload.proofs?.[0].mintUrl).toBe('https://a.example')
    expect(payload.proofs?.[1].mintUrl).toBe('https://b.example')
  })

  it('collects mint urls from mints, proofs, and an extra url', () => {
    const urls = collectMintUrlsForRestore(
      [mint('https://a.example')],
      [proof('s1', 'https://a.example'), proof('s2', 'https://b.example')],
      ' https://c.example '
    )

    expect(urls).toStrictEqual([
      'https://a.example',
      'https://b.example',
      'https://c.example'
    ])
  })

  it('backfills mintUrl from a single mint', () => {
    const restored = normalizeRestoredProofs(
      [{ C: 'C', amount: 1, id: 'ks', mintUrl: '', secret: 's1' }],
      [mint('https://only.example')]
    )

    expect(restored[0].mintUrl).toBe('https://only.example')
  })

  it('does not assign mints[0] when several mints and mintUrl is missing', () => {
    expect(() =>
      normalizeRestoredProofs(
        [
          { C: 'C', amount: 1, id: 'ks', mintUrl: '', secret: 's1' },
          proof('s2', 'https://b.example')
        ],
        [mint('https://a.example'), mint('https://b.example')]
      )
    ).toThrow(EcashBackupValidationError)
  })

  it('restores mint keysets from the backup', () => {
    const parsed = parseEcashBackupPayload({
      mints: [
        {
          ...mint('https://a.example'),
          keysets: [{ active: true, id: 'ks1', unit: 'sat' }]
        }
      ],
      proofs: [proof('s1', 'https://a.example')]
    })
    expect(parsed.mints[0].keysets).toStrictEqual([
      { active: true, id: 'ks1', unit: 'sat' }
    ])
  })

  it('refuses backups that omit proofs', () => {
    expect(() =>
      parseEcashBackupPayload({
        mints: [mint('https://a.example')],
        version: '1'
      })
    ).toThrow(EcashBackupValidationError)
  })

  it('refuses backups whose mints field is not an array', () => {
    expect(() =>
      parseEcashBackupPayload({
        mints: 'abc',
        proofs: [proof('s1', 'https://a.example')]
      })
    ).toThrow(EcashBackupValidationError)
  })

  it('parses a valid backup payload', () => {
    const parsed = parseEcashBackupPayload({
      mints: [mint('https://a.example')],
      proofs: [proof('s1', 'https://a.example')],
      transactions: []
    })
    expect(parsed.proofs).toHaveLength(1)
    expect(parsed.mints[0].url).toBe('https://a.example')
  })

  it('refuses proofs whose mint is missing from the backup', () => {
    expect(() =>
      parseEcashBackupPayload({
        proofs: [proof('s1', 'https://a.example')]
      })
    ).toThrow(EcashBackupValidationError)
  })

  it('refuses transactions with an empty id', () => {
    expect(() =>
      parseEcashBackupPayload({
        mints: [mint('https://a.example')],
        proofs: [proof('s1', 'https://a.example')],
        transactions: [
          {
            amount: 1,
            id: '',
            mintUrl: 'https://a.example',
            timestamp: '2024-01-01T00:00:00.000Z',
            type: 'receive'
          }
        ]
      })
    ).toThrow(EcashBackupValidationError)
  })
})
