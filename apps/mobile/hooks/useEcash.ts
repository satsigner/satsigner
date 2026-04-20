import { useState } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  checkMintQuote,
  clearWalletCache,
  connectToMint,
  createMeltQuote,
  createMintQuote,
  getMintBalance,
  meltProofs,
  mintProofs,
  receiveEcash,
  restoreProofsFromSeed,
  sendEcash,
  validateEcashToken
} from '@/api/ecash'
import { t } from '@/locales'
import { getEcashMnemonic } from '@/storage/encrypted'
import { useEcashStore } from '@/store/ecash'
import type {
  EcashKeysetCounter,
  EcashMeltResult,
  EcashMint,
  EcashMintResult,
  EcashProof,
  EcashReceiveResult,
  EcashSendResult,
  EcashTransaction,
  MeltQuote,
  MintQuote,
  MintQuoteState,
  WalletOptions
} from '@/types/models/Ecash'
import { mnemonicToSeed } from '@/utils/bip39'
import { randomKey } from '@/utils/crypto'

const POLL_INTERVAL = 1500
const MAX_POLL_ATTEMPTS = 120

type TokenValidationResult = {
  isValid: boolean
  isSpent?: boolean
  details?: string
}

function resolveTokenStatus(
  result: TokenValidationResult
): 'spent' | 'unspent' | 'invalid' | 'pending' | undefined {
  if (result.isValid === false) {
    return 'invalid'
  }
  if (result.isSpent === true) {
    return 'spent'
  }
  if (result.isSpent === false) {
    return 'unspent'
  }
  if (
    result.isSpent === undefined &&
    result.details?.toLowerCase().includes('pending')
  ) {
    return 'pending'
  }
  return undefined
}

async function getSeedForAccount(
  accountId: string
): Promise<Uint8Array | undefined> {
  const mnemonic = await getEcashMnemonic(accountId)
  if (!mnemonic) {
    return undefined
  }
  return mnemonicToSeed(mnemonic, '')
}

function buildCounterInit(
  counters: EcashKeysetCounter[]
): Record<string, number> {
  const init: Record<string, number> = {}
  for (const c of counters) {
    init[c.keysetId] = c.counter
  }
  return init
}

export function useEcash() {
  const [
    accounts,
    activeAccountId,
    allMints,
    allProofs,
    allTransactions,
    allMintQuotes,
    allCounters,
    checkingTransactionIds,
    addAccount,
    removeAccount,
    setActiveAccountId,
    addMintAction,
    removeMintAction,
    addProofsAction,
    removeProofsAction,
    updateMintBalance,
    addMintQuoteAction,
    removeMintQuoteAction,
    addMeltQuoteAction,
    removeMeltQuoteAction,
    addTransactionAction,
    updateTransactionAction,
    updateCountersAction,
    restoreFromBackup,
    clearAllData,
    clearAccountData,
    addCheckingTransaction,
    removeCheckingTransaction
  ] = useEcashStore(
    useShallow((state) => [
      state.accounts,
      state.activeAccountId,
      state.mints,
      state.proofs,
      state.transactions,
      state.quotes,
      state.counters,
      state.checkingTransactionIds,
      state.addAccount,
      state.removeAccount,
      state.setActiveAccountId,
      state.addMint,
      state.removeMint,
      state.addProofs,
      state.removeProofs,
      state.updateMintBalance,
      state.addMintQuote,
      state.removeMintQuote,
      state.addMeltQuote,
      state.removeMeltQuote,
      state.addTransaction,
      state.updateTransaction,
      state.updateCounters,
      state.restoreFromBackup,
      state.clearAllData,
      state.clearAccountData,
      state.addCheckingTransaction,
      state.removeCheckingTransaction
    ])
  )

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null
  const mints = activeAccountId ? (allMints[activeAccountId] ?? []) : []
  const proofs = activeAccountId ? (allProofs[activeAccountId] ?? []) : []
  const transactions = activeAccountId
    ? (allTransactions[activeAccountId] ?? [])
    : []
  const mintQuotes = activeAccountId
    ? (allMintQuotes[activeAccountId]?.mint ?? [])
    : []
  const counters = activeAccountId ? (allCounters[activeAccountId] ?? []) : []

  function handleCounterReserved(event: {
    keysetId: string
    start: number
    count: number
  }) {
    if (!activeAccountId) {
      return
    }
    const nextCounter = event.start + event.count
    const updatedCounters = [
      ...counters.filter((c) => c.keysetId !== event.keysetId),
      { counter: nextCounter, keysetId: event.keysetId }
    ]
    updateCountersAction(activeAccountId, updatedCounters)
  }

  async function getWalletOptions(): Promise<WalletOptions> {
    if (!activeAccountId || !activeAccount?.hasSeed) {
      return {}
    }
    const seed = await getSeedForAccount(activeAccountId)
    if (!seed) {
      return {}
    }
    return {
      bip39seed: seed,
      counterInit: buildCounterInit(counters),
      onCounterReserved: handleCounterReserved
    }
  }

  async function connectToMintHandler(mintUrl: string): Promise<EcashMint> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }

    const existingMint = mints.find((m) => m.url === mintUrl)
    if (existingMint) {
      toast.info(t('ecash.info.mintAlreadyConnected'))
      return existingMint
    }

    const mint = await connectToMint(mintUrl)
    addMintAction(activeAccountId, mint)
    toast.success(t('ecash.success.mintConnected'))

    if (activeAccount?.hasSeed) {
      try {
        const seed = await getSeedForAccount(activeAccountId)
        if (seed) {
          toast.info(t('ecash.recovery.restoring'))
          const counterInit = buildCounterInit(counters)
          const result = await restoreProofsFromSeed(
            activeAccountId,
            mintUrl,
            seed,
            counterInit
          )

          if (result.proofs.length > 0) {
            addProofsAction(activeAccountId, result.proofs)
            updateMintBalance(
              activeAccountId,
              mintUrl,
              result.proofs.reduce((s, p) => s + p.amount, 0)
            )

            if (result.lastCounter !== undefined) {
              const activeKeyset = mint.keysets.find((ks) => ks.active)
              if (activeKeyset) {
                const updatedCounters = [
                  ...counters.filter((c) => c.keysetId !== activeKeyset.id),
                  {
                    counter: result.lastCounter + 1,
                    keysetId: activeKeyset.id
                  }
                ]
                updateCountersAction(activeAccountId, updatedCounters)
              }
            }

            toast.success(
              t('ecash.success.proofsRestored', {
                count: result.proofs.length
              })
            )
          } else {
            toast.info(t('ecash.info.noProofsFound'))
          }
        } else {
          toast.warning(t('ecash.recovery.seedNotFound'))
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(t('ecash.recovery.restoreFailed', { error: message }))
      }
    }

    return mint
  }

  function disconnectMint(mintUrl: string) {
    if (!activeAccountId) {
      return
    }
    removeMintAction(activeAccountId, mintUrl)
    clearWalletCache(activeAccountId, mintUrl)
  }

  async function createMintQuoteHandler(
    mintUrl: string,
    amount: number,
    memo?: string
  ): Promise<MintQuote> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }
    const options = await getWalletOptions()
    const quote = await createMintQuote(
      activeAccountId,
      mintUrl,
      amount,
      options
    )
    addMintQuoteAction(activeAccountId, quote)

    const transaction: EcashTransaction = {
      amount,
      expiry: quote.expiry,
      id: quote.quote,
      label: memo,
      memo,
      mintUrl,
      quoteId: quote.quote,
      status: 'pending',
      timestamp: new Date().toISOString(),
      type: 'mint'
    }
    addTransactionAction(activeAccountId, transaction)

    return quote
  }

  async function checkMintQuoteHandler(
    mintUrl: string,
    quoteId: string
  ): Promise<MintQuoteState> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }
    const options = await getWalletOptions()
    return checkMintQuote(activeAccountId, mintUrl, quoteId, options)
  }

  async function mintProofsHandler(
    mintUrl: string,
    amount: number,
    quoteId: string
  ): Promise<EcashMintResult> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }
    const options = await getWalletOptions()
    const result = await mintProofs(
      activeAccountId,
      mintUrl,
      amount,
      quoteId,
      options
    )
    addProofsAction(activeAccountId, result.proofs)
    removeMintQuoteAction(activeAccountId, quoteId)
    updateMintBalance(
      activeAccountId,
      mintUrl,
      getMintBalance(mintUrl, [...proofs, ...result.proofs])
    )

    updateTransactionAction(activeAccountId, quoteId, {
      status: 'completed'
    })

    toast.success(t('ecash.success.tokensMinted'))
    return result
  }

  async function createMeltQuoteHandler(
    mintUrl: string,
    invoice: string
  ): Promise<MeltQuote> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }
    const options = await getWalletOptions()
    const quote = await createMeltQuote(
      activeAccountId,
      mintUrl,
      invoice,
      options
    )
    addMeltQuoteAction(activeAccountId, quote)
    return quote
  }

  function markReceivedTokensAsSpent() {
    if (!activeAccountId) {
      return
    }
    for (const transaction of transactions) {
      if (
        transaction.type === 'receive' &&
        transaction.tokenStatus === 'unspent'
      ) {
        updateTransactionAction(activeAccountId, transaction.id, {
          tokenStatus: 'spent'
        })
      }
    }
  }

  async function meltProofsHandler(
    mintUrl: string,
    quote: MeltQuote,
    proofsToMelt: EcashProof[],
    description?: string,
    originalInvoice?: string
  ): Promise<EcashMeltResult> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }
    const options = await getWalletOptions()
    const result = await meltProofs(
      activeAccountId,
      mintUrl,
      quote,
      proofsToMelt,
      description,
      originalInvoice,
      options
    )
    const proofIds = proofsToMelt.map((proof) => proof.id)
    removeProofsAction(activeAccountId, proofIds)
    removeMeltQuoteAction(activeAccountId, quote.quote)

    if (result.change) {
      addProofsAction(activeAccountId, result.change)
    }

    updateMintBalance(
      activeAccountId,
      mintUrl,
      getMintBalance(
        mintUrl,
        proofs.filter((p) => !proofIds.includes(p.id))
      )
    )

    markReceivedTokensAsSpent()

    addTransactionAction(activeAccountId, {
      amount: quote.amount,
      expiry: quote.expiry,
      id: `melt_${Date.now()}_${await randomKey(9)}`,
      invoice: quote.quote,
      label: description,
      memo: description,
      mintUrl,
      quoteId: quote.quote,
      status: 'settled',
      timestamp: new Date().toISOString(),
      type: 'melt'
    })

    toast.success(t('ecash.success.tokensMelted'))
    return result
  }

  async function sendEcashHandler(
    mintUrl: string,
    amount: number,
    memo?: string
  ): Promise<EcashSendResult> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }
    const options = await getWalletOptions()

    const mintProofsList = proofs.filter((p) => p.mintUrl === mintUrl)

    try {
      const result = await sendEcash(
        activeAccountId,
        mintUrl,
        amount,
        mintProofsList,
        memo,
        options
      )
      const proofIds = result.send.map((proof) => proof.id)
      removeProofsAction(activeAccountId, proofIds)
      addProofsAction(activeAccountId, result.keep)
      updateMintBalance(
        activeAccountId,
        mintUrl,
        getMintBalance(mintUrl, result.keep)
      )

      markReceivedTokensAsSpent()

      addTransactionAction(activeAccountId, {
        amount,
        id: `send_${Date.now()}_${await randomKey(9)}`,
        memo,
        mintUrl,
        timestamp: new Date().toISOString(),
        token: result.token,
        type: 'send'
      })

      toast.success(t('ecash.success.tokenGenerated'))
      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('ecash.error.networkError')

      if (
        errorMessage.includes('Token already spent') ||
        errorMessage.includes('spent')
      ) {
        removeProofsAction(
          activeAccountId,
          mintProofsList.map((proof) => proof.id)
        )
        updateMintBalance(activeAccountId, mintUrl, 0)
      }

      toast.error(errorMessage)
      throw error
    }
  }

  async function receiveEcashHandler(
    mintUrl: string,
    token: string
  ): Promise<EcashReceiveResult> {
    if (!activeAccountId) {
      throw new Error('No active account')
    }
    const options = await getWalletOptions()

    try {
      const result = await receiveEcash(
        activeAccountId,
        mintUrl,
        token,
        options
      )
      addProofsAction(activeAccountId, result.proofs)
      updateMintBalance(
        activeAccountId,
        mintUrl,
        getMintBalance(mintUrl, [...proofs, ...result.proofs])
      )

      addTransactionAction(activeAccountId, {
        amount: result.totalAmount,
        id: `receive_${Date.now()}_${await randomKey(9)}`,
        label: result.memo,
        memo: result.memo,
        mintUrl,
        status: 'completed',
        timestamp: new Date().toISOString(),
        tokenStatus: 'unspent',
        type: 'receive'
      })

      toast.success(t('ecash.success.tokenRedeemed'))
      return result
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : t('ecash.error.networkError')
      // Mints report already-claimed tokens through varied error strings
      // ("Token already spent", "outputs already signed before", "already used",
      // etc.). Surface a single localized message so the user knows the token
      // is unrecoverable instead of seeing cryptic mint internals.
      const lower = rawMessage.toLowerCase()
      const isAlreadyClaimed =
        lower.includes('already spent') ||
        lower.includes('already signed') ||
        lower.includes('already used') ||
        lower.includes('already_spent') ||
        lower.includes('token spent')
      const errorMessage = isAlreadyClaimed
        ? t('ecash.error.tokenAlreadyClaimed')
        : rawMessage

      addTransactionAction(activeAccountId, {
        amount: 0,
        id: `receive_failed_${Date.now()}_${await randomKey(9)}`,
        label: `Failed: ${errorMessage}`,
        memo: errorMessage,
        mintUrl,
        status: 'failed',
        timestamp: new Date().toISOString(),
        type: 'receive'
      })

      toast.error(errorMessage)
      throw error
    }
  }

  async function restoreFromSeedHandler(mintUrl: string): Promise<{
    proofsFound: number
    totalAmount: number
  }> {
    if (!activeAccountId || !activeAccount?.hasSeed) {
      throw new Error('Account has no seed for recovery')
    }

    const seed = await getSeedForAccount(activeAccountId)
    if (!seed) {
      throw new Error('Could not retrieve seed')
    }

    const counterInit = buildCounterInit(counters)
    const result = await restoreProofsFromSeed(
      activeAccountId,
      mintUrl,
      seed,
      counterInit
    )

    if (result.proofs.length > 0) {
      addProofsAction(activeAccountId, result.proofs)
      const totalAmount = result.proofs.reduce((s, p) => s + p.amount, 0)
      updateMintBalance(
        activeAccountId,
        mintUrl,
        getMintBalance(mintUrl, [...proofs, ...result.proofs])
      )

      if (result.lastCounter !== undefined) {
        const activeKeyset = mints
          .find((m) => m.url === mintUrl)
          ?.keysets.find((ks) => ks.active)
        if (activeKeyset) {
          const updatedCounters = [
            ...counters.filter((c) => c.keysetId !== activeKeyset.id),
            { counter: result.lastCounter + 1, keysetId: activeKeyset.id }
          ]
          updateCountersAction(activeAccountId, updatedCounters)
        }
      }

      toast.success(
        t('ecash.success.proofsRestored', { count: result.proofs.length })
      )
      return { proofsFound: result.proofs.length, totalAmount }
    }

    toast.info(t('ecash.info.noProofsFound'))
    return { proofsFound: 0, totalAmount: 0 }
  }

  async function validateToken(
    token: string,
    mintUrl: string
  ): Promise<boolean> {
    if (!activeAccountId) {
      return false
    }
    try {
      const options = await getWalletOptions()
      const result = await validateEcashToken(
        token,
        activeAccountId,
        mintUrl,
        options
      )
      return result.isValid
    } catch {
      return false
    }
  }

  async function checkTokenStatus(
    token: string,
    mintUrl: string
  ): Promise<{ isValid: boolean; isSpent?: boolean; details?: string }> {
    if (!activeAccountId) {
      return { details: 'No active account', isValid: false }
    }
    try {
      const options = await getWalletOptions()
      return await validateEcashToken(token, activeAccountId, mintUrl, options)
    } catch (error) {
      return {
        details: error instanceof Error ? error.message : 'Check failed',
        isValid: false
      }
    }
  }

  function restoreFromBackupHandler(backupData: unknown) {
    if (!activeAccountId) {
      return
    }
    restoreFromBackup(activeAccountId, backupData)
    toast.success(t('ecash.success.backupRestored'))
  }

  function clearAllDataHandler() {
    clearAllData()
    toast.success(t('ecash.success.dataCleared'))
  }

  function clearAccountDataHandler() {
    if (!activeAccountId) {
      return
    }
    clearAccountData(activeAccountId)
    toast.success(t('ecash.success.dataCleared'))
  }

  async function checkPendingTransactionStatus() {
    if (!activeAccountId) {
      return
    }
    const currentCheckingIds = checkingTransactionIds

    const transactionsToCheck = transactions.filter((tx) => {
      const isSend = tx.type === 'send'
      const hasValidStatus =
        tx.tokenStatus === undefined ||
        tx.tokenStatus === 'unspent' ||
        tx.tokenStatus === 'invalid'
      const hasToken =
        tx.token && typeof tx.token === 'string' && tx.token.trim().length > 0
      const notChecking = !currentCheckingIds.includes(tx.id)

      return isSend && hasValidStatus && hasToken && notChecking
    })

    if (transactionsToCheck.length === 0) {
      return
    }

    const options = await getWalletOptions()

    for (const transaction of transactionsToCheck) {
      if (checkingTransactionIds.includes(transaction.id)) {
        continue
      }

      try {
        addCheckingTransaction(transaction.id)

        const result = await validateEcashToken(
          transaction.token!,
          activeAccountId,
          transaction.mintUrl,
          options
        )

        const tokenStatus = resolveTokenStatus(result)

        const currentTx = transactions.find((txn) => txn.id === transaction.id)
        if (
          currentTx &&
          tokenStatus !== undefined &&
          currentTx.tokenStatus !== tokenStatus
        ) {
          updateTransactionAction(activeAccountId, transaction.id, {
            tokenStatus
          })
        }
      } catch {
        // Continue processing other transactions on error
      } finally {
        removeCheckingTransaction(transaction.id)
        await new Promise((resolve) => {
          setTimeout(resolve, 500)
        })
      }
    }
  }

  function resumePollingForTransaction(
    transactionId: string,
    startPolling: (pollFunction: () => Promise<boolean>) => void
  ) {
    if (!activeAccountId) {
      return
    }
    const transaction = transactions.find((txn) => txn.id === transactionId)
    if (
      !transaction ||
      transaction.status !== 'pending' ||
      !transaction.quoteId
    ) {
      return
    }

    const mint = mints.find((m) => m.url === transaction.mintUrl)
    if (!mint) {
      return
    }

    startPolling(async () => {
      try {
        const status = await checkMintQuoteHandler(
          mint.url,
          transaction.quoteId!
        )

        if (status === 'PAID' || status === 'ISSUED') {
          await mintProofsHandler(
            mint.url,
            transaction.amount,
            transaction.quoteId!
          )
          return true
        } else if (status === 'EXPIRED' || status === 'CANCELLED') {
          updateTransactionAction(activeAccountId!, transactionId, {
            status: 'failed'
          })
          return true
        }
        return false
      } catch {
        return false
      }
    })
  }

  return {
    accounts,
    activeAccount,
    activeAccountId,
    addAccount,
    checkMintQuote: checkMintQuoteHandler,
    checkPendingTransactionStatus,
    checkTokenStatus,
    checkingTransactionIds,
    clearAccountData: clearAccountDataHandler,
    clearAllData: clearAllDataHandler,
    connectToMint: connectToMintHandler,
    counters,
    createMeltQuote: createMeltQuoteHandler,
    createMintQuote: createMintQuoteHandler,
    disconnectMint,
    markReceivedTokensAsSpent,
    meltProofs: meltProofsHandler,
    mintProofs: mintProofsHandler,
    mintQuotes,
    mints,
    proofs,
    receiveEcash: receiveEcashHandler,
    removeAccount,
    restoreFromBackup: restoreFromBackupHandler,
    restoreFromSeed: restoreFromSeedHandler,
    resumePollingForTransaction,
    sendEcash: sendEcashHandler,
    setActiveAccountId,
    transactions,
    updateTransaction: (
      transactionId: string,
      updates: Partial<EcashTransaction>
    ) => {
      if (!activeAccountId) {
        return
      }
      updateTransactionAction(activeAccountId, transactionId, updates)
    },
    validateToken
  }
}

export function useQuotePolling() {
  const [isPolling, setIsPolling] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const [, setLastPollTime] = useState(0)
  const isPollingRef = { current: false }
  const timeoutRef = { current: null as NodeJS.Timeout | null }

  function startPolling(pollFunction: () => Promise<boolean>) {
    setIsPolling(true)
    isPollingRef.current = true
    setPollCount(0)
    setLastPollTime(Date.now())

    let currentPollCount = 0
    let currentLastPollTime = Date.now()

    const poll = async () => {
      if (currentPollCount >= MAX_POLL_ATTEMPTS) {
        setIsPolling(false)
        isPollingRef.current = false
        return
      }

      if (!isPollingRef.current) {
        return
      }

      const now = Date.now()
      if (now - currentLastPollTime < POLL_INTERVAL) {
        const delay = POLL_INTERVAL - (now - currentLastPollTime)
        timeoutRef.current = setTimeout(poll, delay)
        return
      }

      try {
        const shouldStop = await pollFunction()
        currentPollCount += 1
        currentLastPollTime = now
        setPollCount(currentPollCount)
        setLastPollTime(currentLastPollTime)

        if (shouldStop || !isPollingRef.current) {
          setIsPolling(false)
          isPollingRef.current = false
          return
        }

        if (isPollingRef.current) {
          timeoutRef.current = setTimeout(poll, POLL_INTERVAL)
        }
      } catch {
        currentPollCount += 1
        currentLastPollTime = now
        setPollCount(currentPollCount)
        setLastPollTime(currentLastPollTime)

        if (isPollingRef.current && currentPollCount < MAX_POLL_ATTEMPTS) {
          timeoutRef.current = setTimeout(poll, POLL_INTERVAL)
        } else {
          setIsPolling(false)
          isPollingRef.current = false
        }
      }
    }

    poll()
  }

  function stopPolling() {
    setIsPolling(false)
    isPollingRef.current = false
    setPollCount(0)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  return {
    isPolling,
    pollCount,
    startPolling,
    stopPolling
  }
}
