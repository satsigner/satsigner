import { type EcashMint, type EcashProof } from '@/types/models/Ecash'
import {
  buildEcashBackupPayload,
  collectMintUrlsForRestore,
  normalizeRestoredProofs
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
    const restored = normalizeRestoredProofs(
      [
        { C: 'C', amount: 1, id: 'ks', mintUrl: '', secret: 's1' },
        proof('s2', 'https://b.example')
      ],
      [mint('https://a.example'), mint('https://b.example')]
    )

    expect(restored).toHaveLength(1)
    expect(restored[0].secret).toBe('s2')
    expect(restored[0].mintUrl).toBe('https://b.example')
  })
})
