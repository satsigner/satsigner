import { useCallback, useEffect, useRef, useState } from 'react'
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
  sendEcash,
  validateEcashToken
} from '@/api/ecash'
import { t } from '@/locales'
import { useEcashStore } from '@/store/ecash'
import {
  type EcashMeltResult,
  type EcashMint,
  type EcashMintResult,
  type EcashProof,
  type EcashReceiveResult,
  type EcashSendResult,
  type EcashTransaction,
  type MeltQuote,
  type MintQuote,
  type MintQuoteState
} from '@/types/models/Ecash'
import { randomKey } from '@/utils/crypto'

const POLL_INTERVAL = 1500
const MAX_POLL_ATTEMPTS = 120

export function useEcash() {
  const [
    mints,
    activeMint,
    proofs,
    transactions,
    mintQuotes,
    checkingTransactionIds,
    addMint,
    removeMint,
    setActiveMint,
    addProofs,
    removeProofs,
    updateMintBalance,
    addMintQuote,
    removeMintQuote,
    addMeltQuote,
    removeMeltQuote,
    addTransaction,
    updateTransaction,
    restoreFromBackup,
    clearAllData,
    addCheckingTransaction,
    removeCheckingTransaction
  ] = useEcashStore(
    useShallow((state) => [
      state.mints,
      state.activeMint,
      state.proofs,
      state.transactions,
      state.quotes.mint,
      state.checkingTransactionIds,
      state.addMint,
      state.removeMint,
      state.setActiveMint,
      state.addProofs,
      state.removeProofs,
      state.updateMintBalance,
      state.addMintQuote,
      state.removeMintQuote,
      state.addMeltQuote,
      state.removeMeltQuote,
      state.addTransaction,
      state.updateTransaction,
      state.restoreFromBackup,
      state.clearAllData,
      state.addCheckingTransaction,
      state.removeCheckingTransaction
    ])
  )

  const markReceivedTokensAsSpent = useCallback(() => {
    for (const transaction of transactions) {
      if (
        transaction.type === 'receive' &&
        transaction.tokenStatus === 'unspent'
      ) {
        updateTransaction(transaction.id, { tokenStatus: 'spent' })
      }
    }
  }, [transactions, updateTransaction])

  const connectToMintHandler = useCallback(
    async (mintUrl: string): Promise<EcashMint> => {
      if (mints.length > 0) {
        const [existingMint] = mints
        removeMint(existingMint.url)
        clearWalletCache(existingMint.url)
        toast.info(t('ecash.info.mintDisconnected'))
      }

      const mint = await connectToMint(mintUrl)
      addMint(mint)
      setActiveMint(mint)

      toast.success(t('ecash.success.mintConnected'))
      return mint
    },
    [addMint, mints, removeMint, setActiveMint]
  )

  const disconnectMint = useCallback(
    (mintUrl: string) => {
      removeMint(mintUrl)
      clearWalletCache(mintUrl)
      if (activeMint?.url === mintUrl) {
        setActiveMint(null)
      }
    },
    [removeMint, activeMint, setActiveMint]
  )

  const createMintQuoteHandler = useCallback(
    async (
      mintUrl: string,
      amount: number,
      memo?: string
    ): Promise<MintQuote> => {
      const quote = await createMintQuote(mintUrl, amount)
      addMintQuote(quote)

      const transaction: EcashTransaction = {
        amount,
        expiry: quote.expiry,
        id: quote.quote,
        label: memo, // Use memo as the transaction label
        memo,
        mintUrl,
        quoteId: quote.quote,
        status: 'pending',
        timestamp: new Date().toISOString(),
        type: 'mint'
      }
      addTransaction(transaction)

      return quote
    },
    [addMintQuote, addTransaction]
  )

  const checkMintQuoteHandler = useCallback(
    async (mintUrl: string, quoteId: string): Promise<MintQuoteState> => {
      return checkMintQuote(mintUrl, quoteId)
    },
    []
  )

  const mintProofsHandler = useCallback(
    async (
      mintUrl: string,
      amount: number,
      quoteId: string
    ): Promise<EcashMintResult> => {
      const result = await mintProofs(mintUrl, amount, quoteId)
      addProofs(result.proofs)
      removeMintQuote(quoteId)
      updateMintBalance(
        mintUrl,
        await getMintBalance(mintUrl, [...proofs, ...result.proofs])
      )

      // Update existing transaction status to completed
      updateTransaction(quoteId, {
        status: 'completed'
      })

      toast.success(t('ecash.success.tokensMinted'))
      return result
    },
    [addProofs, removeMintQuote, updateMintBalance, proofs, updateTransaction]
  )

  const createMeltQuoteHandler = useCallback(
    async (mintUrl: string, invoice: string): Promise<MeltQuote> => {
      const quote = await createMeltQuote(mintUrl, invoice)
      addMeltQuote(quote)
      return quote
    },
    [addMeltQuote]
  )

  const meltProofsHandler = useCallback(
    async (
      mintUrl: string,
      quote: MeltQuote,
      proofsToMelt: EcashProof[],
      description?: string,
      originalInvoice?: string
    ): Promise<EcashMeltResult> => {
      const result = await meltProofs(
        mintUrl,
        quote,
        proofsToMelt,
        description,
        originalInvoice
      )
      const proofIds = proofsToMelt.map((proof) => proof.id)
      removeProofs(proofIds)
      removeMeltQuote(quote.quote)

      if (result.change) {
        addProofs(result.change)
      }

      updateMintBalance(
        mintUrl,
        await getMintBalance(
          mintUrl,
          proofs.filter((p) => !proofIds.includes(p.id))
        )
      )

      // Mark received tokens as spent
      markReceivedTokensAsSpent()

      // Add transaction record
      addTransaction({
        amount: quote.amount,
        expiry: quote.expiry,
        id: `melt_${Date.now()}_${randomKey(9)}`,
        invoice: quote.quote, // Store the invoice for reference
        label: description, // Use description as the transaction label
        memo: description, // Also store as memo for backward compatibility
        mintUrl,
        quoteId: quote.quote,
        status: 'settled',
        timestamp: new Date().toISOString(),
        type: 'melt'
      })

      toast.success(t('ecash.success.tokensMelted'))
      return result
    },
    [
      removeProofs,
      removeMeltQuote,
      addProofs,
      updateMintBalance,
      proofs,
      addTransaction,
      markReceivedTokensAsSpent
    ]
  )

  const sendEcashHandler = useCallback(
    async (
      mintUrl: string,
      amount: number,
      memo?: string
    ): Promise<EcashSendResult> => {
      try {
        const result = await sendEcash(mintUrl, amount, proofs, memo)
        const proofIds = result.send.map((proof) => proof.id)
        removeProofs(proofIds)
        addProofs(result.keep)
        updateMintBalance(mintUrl, await getMintBalance(mintUrl, result.keep))

        // Mark received tokens as spent
        markReceivedTokensAsSpent()

        // Add transaction record
        addTransaction({
          amount,
          id: `send_${Date.now()}_${randomKey(9)}`,
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

        // If the error is about spent proofs, we should clean up the store
        if (
          errorMessage.includes('Token already spent') ||
          errorMessage.includes('spent')
        ) {
          removeProofs(proofs.map((proof) => proof.id))
          updateMintBalance(mintUrl, 0)
        }

        toast.error(errorMessage)
        throw error
      }
    },
    [
      proofs,
      removeProofs,
      addProofs,
      updateMintBalance,
      addTransaction,
      markReceivedTokensAsSpent
    ]
  )

  const receiveEcashHandler = useCallback(
    async (mintUrl: string, token: string): Promise<EcashReceiveResult> => {
      try {
        const result = await receiveEcash(mintUrl, token)
        addProofs(result.proofs)
        updateMintBalance(
          mintUrl,
          await getMintBalance(mintUrl, [...proofs, ...result.proofs])
        )

        // Add transaction record
        addTransaction({
          amount: result.totalAmount,
          id: `receive_${Date.now()}_${randomKey(9)}`,
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
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')

        // Add failed transaction record
        addTransaction({
          amount: 0, // Unknown amount for failed transactions
          id: `receive_failed_${Date.now()}_${randomKey(9)}`,
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
    },
    [addProofs, updateMintBalance, proofs, addTransaction]
  )

  const validateToken = useCallback(
    async (token: string, mintUrl: string): Promise<boolean> => {
      try {
        const result = await validateEcashToken(token, mintUrl)
        return result.isValid
      } catch {
        return false
      }
    },
    []
  )

  const restoreFromBackupHandler = useCallback(
    (backupData: unknown) => {
      restoreFromBackup(backupData)
      toast.success(t('ecash.success.backupRestored'))
    },
    [restoreFromBackup]
  )

  const clearAllDataHandler = useCallback(() => {
    clearAllData()
    toast.success(t('ecash.success.dataCleared'))
  }, [clearAllData])

  const checkPendingTransactionStatus = useCallback(async () => {
    const currentTransactions = transactions
    const currentCheckingIds = checkingTransactionIds

    // We check "invalid" to re-validate them and get proper status (e.g., if they were marked invalid due to rate limiting)
    const transactionsToCheck = currentTransactions.filter((tx) => {
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

    for (const transaction of transactionsToCheck) {
      const stillChecking = checkingTransactionIds
      if (stillChecking.includes(transaction.id)) {
        continue
      }

      try {
        addCheckingTransaction(transaction.id)

        const result = await validateEcashToken(
          transaction.token!,
          transaction.mintUrl
        )

        let tokenStatus: 'spent' | 'unspent' | 'invalid' | 'pending' | undefined
        if (result.isValid === false) {
          tokenStatus = 'invalid'
        } else if (result.isSpent === true) {
          tokenStatus = 'spent'
        } else if (result.isSpent === false) {
          tokenStatus = 'unspent'
        } else if (
          result.isSpent === undefined &&
          result.details?.toLowerCase().includes('pending')
        ) {
          tokenStatus = 'pending'
        }

        const currentTx = transactions.find((t) => t.id === transaction.id)
        if (
          currentTx &&
          tokenStatus !== undefined &&
          currentTx.tokenStatus !== tokenStatus
        ) {
          updateTransaction(transaction.id, { tokenStatus })
        }
      } catch {
        // Continue processing other transactions on error
      } finally {
        removeCheckingTransaction(transaction.id)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }, [addCheckingTransaction, removeCheckingTransaction, updateTransaction]) // eslint-disable-line react-hooks/exhaustive-deps

  const resumePollingForTransaction = useCallback(
    async (
      transactionId: string,
      startPolling: (pollFunction: () => Promise<boolean>) => void
    ) => {
      const transaction = transactions.find((t) => t.id === transactionId)
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
            return true // Stop polling
          } else if (status === 'EXPIRED' || status === 'CANCELLED') {
            updateTransaction(transactionId, { status: 'failed' })
            return true // Stop polling
          }
          // Continue polling for PENDING, UNPAID, and unknown statuses
          return false
        } catch {
          // Continue polling on network errors
          return false
        }
      })
    },
    [
      transactions,
      mints,
      checkMintQuoteHandler,
      mintProofsHandler,
      updateTransaction
    ]
  )

  return {
    activeMint,
    checkMintQuote: checkMintQuoteHandler,
    checkPendingTransactionStatus,
    checkingTransactionIds,
    clearAllData: clearAllDataHandler,
    connectToMint: connectToMintHandler,
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
    restoreFromBackup: restoreFromBackupHandler,
    resumePollingForTransaction,
    sendEcash: sendEcashHandler,
    setActiveMint,
    transactions,
    updateTransaction,
    validateToken
  }
}

export function useQuotePolling() {
  const [isPolling, setIsPolling] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const [_lastPollTime, setLastPollTime] = useState(0)
  const isPollingRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const startPolling = useCallback((pollFunction: () => Promise<boolean>) => {
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

        // Stop polling if function returns true or if not active
        if (shouldStop || !isPollingRef.current) {
          setIsPolling(false)
          isPollingRef.current = false
          return
        }

        // Continue polling if still active
        if (isPollingRef.current) {
          timeoutRef.current = setTimeout(poll, POLL_INTERVAL)
        }
      } catch {
        currentPollCount += 1
        currentLastPollTime = now
        setPollCount(currentPollCount)
        setLastPollTime(currentLastPollTime)

        // Continue polling unless it's a critical error or max attempts reached
        if (isPollingRef.current && currentPollCount < MAX_POLL_ATTEMPTS) {
          timeoutRef.current = setTimeout(poll, POLL_INTERVAL)
        } else {
          setIsPolling(false)
          isPollingRef.current = false
        }
      }
    }

    poll()
  }, [])

  const stopPolling = useCallback(() => {
    setIsPolling(false)
    isPollingRef.current = false
    setPollCount(0)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    isPolling,
    pollCount,
    startPolling,
    stopPolling
  }
}
