import { ArkOperationBusyError } from '@/utils/arkError'

// Boarding and sweeping both spend the account's on-chain UTXOs. Two at once
// would pick the same coins, so only one runs per account; the other is
// refused. The UI check alone cannot stop two mounted screens racing.
const accountsSpending = new Set<string>()

async function withArkOnchainSpendLock<T>(
  accountId: string,
  spend: () => Promise<T>
): Promise<T> {
  if (accountsSpending.has(accountId)) {
    throw new ArkOperationBusyError()
  }
  accountsSpending.add(accountId)
  try {
    return await spend()
  } finally {
    accountsSpending.delete(accountId)
  }
}

export { withArkOnchainSpendLock }
