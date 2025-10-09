import * as bitcoinjs from 'bitcoinjs-lib'

import { type Account } from '@/types/models/Account'
import { extractKeyFingerprint } from '@/utils/account'
import { extractTransactionIdFromPSBT } from '@/utils/psbtTransactionExtractor'

export type TransactionData = {
  network: 'mainnet' | 'testnet' | 'signet'
  keyCount: number
  keysRequired: number
  originalPsbt: string
  signedPsbts: Record<number, string>
  timestamp: number
  rbf: boolean
}

export type AccountMatchResult = {
  account: Account
  cosignerIndex: number
  fingerprint: string
  derivationPath: string
  publicKey: string
}

/**
 * Extract BIP32 derivation information from PSBT
 */
export function extractPSBTDerivations(psbtBase64: string): {
  fingerprint: string
  derivationPath: string
  publicKey: string
  inputIndex: number
}[] {
  try {
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
    const derivations: {
      fingerprint: string
      derivationPath: string
      publicKey: string
      inputIndex: number
    }[] = []

    psbt.data.inputs.forEach((input, inputIndex) => {
      if (input.bip32Derivation) {
        input.bip32Derivation.forEach((derivation) => {
          const fingerprint = derivation.masterFingerprint.toString('hex')
          const derivationPath = derivation.path
          const publicKey = derivation.pubkey.toString('hex')

          derivations.push({
            fingerprint,
            derivationPath,
            publicKey,
            inputIndex
          })
        })
      }
    })

    return derivations
  } catch {
    return []
  }
}

/**
 */
export function findMatchingAccount(
  psbtBase64: string,
  accounts: Account[]
): AccountMatchResult | null {
  try {
    const derivations = extractPSBTDerivations(psbtBase64)

    if (derivations.length === 0) {
      return null
    }

    // Get unique fingerprints from PSBT
    const psbtFingerprints = [...new Set(derivations.map((d) => d.fingerprint))]

    // Try to match each account with PSBT derivations
    for (const account of accounts) {
      if (!account.keys || account.keys.length === 0) {
        continue
      }

      // Extract all fingerprints from account keys
      const accountFingerprints: string[] = []
      const keyFingerprintMap = new Map<string, number>() // fingerprint -> keyIndex

      for (let keyIndex = 0; keyIndex < account.keys.length; keyIndex++) {
        const key = account.keys[keyIndex]
        const keyFingerprint = extractKeyFingerprint(key)

        if (keyFingerprint) {
          accountFingerprints.push(keyFingerprint)
          keyFingerprintMap.set(keyFingerprint, keyIndex)
        }
      }

      // Check if ALL PSBT fingerprints are present in this account
      const allFingerprintsMatch = psbtFingerprints.every((psbtFp) =>
        accountFingerprints.includes(psbtFp)
      )

      if (allFingerprintsMatch) {
        // Find the first matching derivation
        const firstMatchingDerivation = derivations.find((d) =>
          accountFingerprints.includes(d.fingerprint)
        )

        if (firstMatchingDerivation) {
          const matchingKeyIndex = keyFingerprintMap.get(
            firstMatchingDerivation.fingerprint
          )!
          return {
            account,
            cosignerIndex: matchingKeyIndex,
            fingerprint: firstMatchingDerivation.fingerprint,
            derivationPath: firstMatchingDerivation.derivationPath,
            publicKey: firstMatchingDerivation.publicKey
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

const transactionDataStorage = new Map<string, TransactionData>()

export function storeTransactionData(data: TransactionData): void {
  const txId = extractTransactionIdFromPSBT(data.originalPsbt)
  if (txId) {
    transactionDataStorage.set(txId, data)
  }
}

export function getTransactionData(txid: string): TransactionData | undefined {
  return transactionDataStorage.get(txid)
}
