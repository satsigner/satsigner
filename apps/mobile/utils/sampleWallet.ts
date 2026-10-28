import {
  sampleMultiAddressTether,
  sampleSalvadorAddress,
  sampleSegwitAddress,
  sampleSignetAddress,
  sampleSignetMultisigKey1,
  sampleSignetMultisigKey2,
  sampleSignetMultisigKey3Fingerprint,
  sampleSignetWalletSeed,
  sampleSignetXpubFingerprint,
  sampleTestnet4Address
} from '@/constants/samples'
import { type Account, type PolicyType } from '@/types/models/Account'
import { type ScriptVersionType } from '@/types/models/Script'
import { type Network } from '@/types/settings/blockchain'
import { getFingerprintFromMnemonic } from '@/utils/bip39'

type SampleWallet =
  | 'segwit'
  | 'legacy'
  | 'watchonlyXpub'
  | 'watchonlyAddress'
  | 'watchonlySalvador'
  | 'watchonlySegwit'
  | 'watchonlyTestnet4'
  | 'watchonlyTether'
  | 'multisig'

type SampleWalletIdentity =
  | {
      fingerprints: string[]
      policyType: PolicyType
      scriptVersion: ScriptVersionType
    }
  | { address: string }

type WatchedAddresses = Record<Account['id'], string | undefined>

function getSampleAccountName(sample: SampleWallet) {
  return `Sample (${sample})`
}

function getSampleWalletIdentity(sample: SampleWallet): SampleWalletIdentity {
  switch (sample) {
    case 'segwit': {
      return {
        fingerprints: [getFingerprintFromMnemonic(sampleSignetWalletSeed)],
        policyType: 'singlesig',
        scriptVersion: 'P2WPKH'
      }
    }
    case 'legacy': {
      return {
        fingerprints: [getFingerprintFromMnemonic(sampleSignetWalletSeed)],
        policyType: 'singlesig',
        scriptVersion: 'P2PKH'
      }
    }
    case 'watchonlyXpub': {
      return {
        fingerprints: [sampleSignetXpubFingerprint],
        policyType: 'watchonly',
        scriptVersion: 'P2PKH'
      }
    }
    case 'multisig': {
      return {
        fingerprints: [
          getFingerprintFromMnemonic(sampleSignetMultisigKey1),
          getFingerprintFromMnemonic(sampleSignetMultisigKey2),
          sampleSignetMultisigKey3Fingerprint
        ],
        policyType: 'multisig',
        scriptVersion: 'P2WSH'
      }
    }
    case 'watchonlyAddress': {
      return { address: sampleSignetAddress }
    }
    case 'watchonlySalvador': {
      return { address: sampleSalvadorAddress }
    }
    case 'watchonlySegwit': {
      return { address: sampleSegwitAddress }
    }
    case 'watchonlyTestnet4': {
      return { address: sampleTestnet4Address }
    }
    case 'watchonlyTether': {
      return { address: sampleMultiAddressTether[0] }
    }
    default: {
      throw new Error(`Unknown sample wallet: ${sample satisfies never}`)
    }
  }
}

function getSortedFingerprints(fingerprints: (string | undefined)[]) {
  return fingerprints
    .map((fingerprint) => fingerprint?.toLowerCase() ?? '')
    .toSorted()
    .join(',')
}

function accountMatchesSampleIdentity(
  account: Account,
  identity: SampleWalletIdentity,
  watchedAddresses: WatchedAddresses
) {
  if ('address' in identity) {
    return (
      watchedAddresses[account.id] === identity.address ||
      account.addresses.some(({ address }) => address === identity.address)
    )
  }
  return (
    account.policyType === identity.policyType &&
    account.keys[0]?.scriptVersion === identity.scriptVersion &&
    getSortedFingerprints(account.keys.map((key) => key.fingerprint)) ===
      getSortedFingerprints(identity.fingerprints)
  )
}

// Matches on the wallet itself rather than the account name, which the user
// can rename after loading the sample.
function isSampleWalletLoaded(
  sample: SampleWallet,
  network: Network,
  accounts: Account[],
  watchedAddresses: WatchedAddresses
) {
  const identity = getSampleWalletIdentity(sample)
  return accounts.some(
    (account) =>
      account.network === network &&
      accountMatchesSampleIdentity(account, identity, watchedAddresses)
  )
}

export { getSampleAccountName, isSampleWalletLoaded }
export type { SampleWallet }
