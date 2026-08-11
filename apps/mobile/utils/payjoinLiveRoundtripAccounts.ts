import {
  CLOWN_ACCOUNT_NAME,
  SAMPLE_SEGWIT_ACCOUNT_NAME,
  sampleSignetXpubFingerprint
} from '@/constants/samples'
import { type Account } from '@/types/models/Account'

function findRoundtripAccount(
  accounts: Account[],
  matcher: (account: Account) => boolean
): Account | undefined {
  return accounts.find(
    (account) =>
      account.network === 'signet' &&
      account.policyType === 'singlesig' &&
      matcher(account)
  )
}

function findSampleAccount(accounts: Account[]): Account | undefined {
  return (
    findRoundtripAccount(
      accounts,
      (account) =>
        account.name.trim().toLowerCase() ===
        SAMPLE_SEGWIT_ACCOUNT_NAME.toLowerCase()
    ) ??
    findRoundtripAccount(
      accounts,
      (account) =>
        account.keys[0]?.fingerprint?.toLowerCase() ===
        sampleSignetXpubFingerprint.toLowerCase()
    ) ??
    findRoundtripAccount(accounts, (account) =>
      /sample.*segwit/i.test(account.name)
    )
  )
}

function findClownAccount(accounts: Account[]): Account | undefined {
  return findRoundtripAccount(
    accounts,
    (account) =>
      account.name.trim().toLowerCase() === CLOWN_ACCOUNT_NAME.toLowerCase()
  )
}

export { findClownAccount, findSampleAccount }
