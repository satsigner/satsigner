import * as bitcoinjs from 'bitcoinjs-lib'

import { type Account } from '@/types/models/Account'
import { findMatchingAccount } from '@/utils/psbt'

const PUBKEY = Buffer.from(
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  'hex'
)

function psbtWithFingerprint(fingerprint: string): string {
  const psbt = new bitcoinjs.Psbt()
  psbt.addInput({
    bip32Derivation: [
      {
        masterFingerprint: Buffer.from(fingerprint, 'hex'),
        path: "m/84'/0'/0'/0/0",
        pubkey: PUBKEY
      }
    ],
    hash: '00'.repeat(32),
    index: 0,
    witnessUtxo: {
      script: Buffer.from(`0014${'00'.repeat(20)}`, 'hex'),
      value: 1000
    }
  })
  return psbt.toBase64()
}

function account(id: string): Account {
  return { id } as Account
}

describe('findMatchingAccount', () => {
  const accounts = [account('a'), account('b')]
  const fingerprints = { a: ['aaaaaaaa'], b: ['cccccccc', 'bbbbbbbb'] }

  it('returns the account and cosigner index owning the fingerprint', () => {
    const match = findMatchingAccount(
      psbtWithFingerprint('bbbbbbbb'),
      accounts,
      fingerprints
    )
    expect(match?.account.id).toBe('b')
    expect(match?.cosignerIndex).toBe(1)
    expect(match?.fingerprint).toBe('bbbbbbbb')
  })

  it('returns null when no account owns the fingerprint', () => {
    expect(
      findMatchingAccount(
        psbtWithFingerprint('dddddddd'),
        accounts,
        fingerprints
      )
    ).toBeNull()
  })

  it('returns null without loaded fingerprints', () => {
    expect(
      findMatchingAccount(psbtWithFingerprint('aaaaaaaa'), accounts, {})
    ).toBeNull()
  })
})
