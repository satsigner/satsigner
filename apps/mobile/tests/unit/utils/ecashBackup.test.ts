import { ECASH_BACKUP_VERSION } from '@/constants/ecash'
import { type EcashMint, type EcashProof } from '@/types/models/Ecash'
import {
  buildEcashBackupPayload,
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
  it('exports mintUrl on every proof', () => {
    const payload = buildEcashBackupPayload({
      includeMintInformation: false,
      includeTokenProofs: true,
      includeTransactionHistory: false,
      mints: [mint('https://a.example')],
      proofs: [proof('s1', 'https://a.example')],
      transactions: []
    })

    expect(payload.version).toBe(ECASH_BACKUP_VERSION)
    expect(payload.proofs?.[0].mintUrl).toBe('https://a.example')
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
