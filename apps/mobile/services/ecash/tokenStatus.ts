import { validateEcashToken } from '@/api/ecash'
import { TOKEN_STATUS_CHECK_THROTTLE_MS } from '@/constants/ecash'
import type { EcashTransaction, WalletOptions } from '@/types/models/Ecash'
import { sleep } from '@/utils/time'

type TokenValidationResult = {
  isValid: boolean
  isSpent?: boolean
  details?: string
}

type TokenStatus = NonNullable<EcashTransaction['tokenStatus']>

type TokenStatusDeps = {
  accountId: string
  options: WalletOptions
  isChecking: (transactionId: string) => boolean
  startChecking: (transactionId: string) => void
  stopChecking: (transactionId: string) => void
  updateTokenStatus: (transactionId: string, tokenStatus: TokenStatus) => void
}

function resolveTokenStatus(
  result: TokenValidationResult
): TokenStatus | undefined {
  if (result.isValid === false) {
    return 'invalid'
  }
  if (result.isSpent === true) {
    return 'spent'
  }
  if (result.isSpent === false) {
    return 'unspent'
  }
  if (result.details?.toLowerCase().includes('pending')) {
    return 'pending'
  }
  return undefined
}

/** Sent tokens whose spent state may have changed since the last check. */
function selectSendTokensToCheck(
  transactions: EcashTransaction[],
  checkingIds: string[]
) {
  return transactions.filter(
    (tx) =>
      tx.type === 'send' &&
      (tx.tokenStatus === undefined ||
        tx.tokenStatus === 'unspent' ||
        tx.tokenStatus === 'invalid') &&
      typeof tx.token === 'string' &&
      tx.token.trim().length > 0 &&
      !checkingIds.includes(tx.id)
  )
}

async function checkTokenStatus(
  transaction: EcashTransaction,
  deps: TokenStatusDeps
) {
  if (!transaction.token) {
    return
  }
  const result = await validateEcashToken(
    transaction.token,
    deps.accountId,
    transaction.mintUrl,
    deps.options
  )
  const tokenStatus = resolveTokenStatus(result)
  if (tokenStatus !== undefined && transaction.tokenStatus !== tokenStatus) {
    deps.updateTokenStatus(transaction.id, tokenStatus)
  }
}

/**
 * Asks each token's mint whether sent tokens were claimed and records the
 * new status. One failing mint does not stop the others.
 */
async function refreshSendTokenStatuses(
  transactions: EcashTransaction[],
  deps: TokenStatusDeps
) {
  for (const transaction of transactions) {
    if (deps.isChecking(transaction.id)) {
      continue
    }
    deps.startChecking(transaction.id)
    await checkTokenStatus(transaction, deps).catch(() => undefined)
    deps.stopChecking(transaction.id)
    await sleep(TOKEN_STATUS_CHECK_THROTTLE_MS)
  }
}

export { refreshSendTokenStatuses, resolveTokenStatus, selectSendTokensToCheck }
