import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner-native'

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

const POLL_INTERVAL = 1500 // 1.5 seconds
const MAX_POLL_ATTEMPTS = 120 // 3 minutes max

// Cache for wallet instances

export function useEcash() {
  const mints = useEcashStore((state) => state.mints)
  const activeMint = useEcashStore((state) => state.activeMint)
  const proofs = useEcashStore((state) => state.proofs)
  const transactions = useEcashStore((state) => state.transactions)
  const mintQuotes = useEcashStore((state) => state.quotes.mint)
  const addMint = useEcashStore((state) => state.addMint)
  const removeMint = useEcashStore((state) => state.removeMint)
  const setActiveMint = useEcashStore((state) => state.setActiveMint)
  const addProofs = useEcashStore((state) => state.addProofs)
  const removeProofs = useEcashStore((state) => state.removeProofs)
  const updateMintBalance = useEcashStore((state) => state.updateMintBalance)
  const addMintQuote = useEcashStore((state) => state.addMintQuote)
  const removeMintQuote = useEcashStore((state) => state.removeMintQuote)
  const addMeltQuote = useEcashStore((state) => state.addMeltQuote)
  const removeMeltQuote = useEcashStore((state) => state.removeMeltQuote)
  const addTransaction = useEcashStore((state) => state.addTransaction)
  const updateTransaction = useEcashStore((state) => state.updateTransaction)
  const restoreFromBackup = useEcashStore((state) => state.restoreFromBackup)
  const clearAllData = useEcashStore((state) => state.clearAllData)

  const markReceivedTokensAsSpent = useCallback(() => {
    // Find receive transactions that contain the spent proofs and mark them as spent
    transactions.forEach((transaction) => {
      if (
        transaction.type === 'receive' &&
        transaction.tokenStatus === 'unspent'
      ) {
        // For now, we'll mark all receive transactions as spent when any proofs are used
        // In a more sophisticated implementation, we could track which specific proofs
        // belong to which receive transaction
        updateTransaction(transaction.id, { tokenStatus: 'spent' })
      }
    })
  }, [transactions, updateTransaction])

  const connectToMintHandler = useCallback(
    async (mintUrl: string): Promise<EcashMint> => {
      try {
        // Disconnect any existing mint before connecting to a new one
        if (mints.length > 0) {
          const existingMint = mints[0]
          removeMint(existingMint.url)
          clearWalletCache(existingMint.url)
          toast.info(t('ecash.info.mintDisconnected'))
        }

        const mint = await connectToMint(mintUrl)
        addMint(mint)
        setActiveMint(mint)
        toast.success(t('ecash.success.mintConnected'))
        return mint
      } catch (error) {
        toast.error(t('ecash.error.mintConnection'))
        throw error
      }
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
      try {
        const quote = await createMintQuote(mintUrl, amount)
        addMintQuote(quote)

        // Add transaction to history immediately with pending status
        const transaction: EcashTransaction = {
          id: quote.quote,
          type: 'mint',
          amount,
          memo,
          label: memo, // Use memo as the transaction label
          mintUrl,
          timestamp: new Date().toISOString(),
          status: 'pending',
          quoteId: quote.quote,
          expiry: quote.expiry
        }
        addTransaction(transaction)

        return quote
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(errorMessage)
        throw error
      }
    },
    [addMintQuote, addTransaction]
  )

  const checkMintQuoteHandler = useCallback(
    async (mintUrl: string, quoteId: string): Promise<MintQuoteState> => {
      try {
        return await checkMintQuote(mintUrl, quoteId)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(errorMessage)
        throw error
      }
    },
    []
  )

  const mintProofsHandler = useCallback(
    async (
      mintUrl: string,
      amount: number,
      quoteId: string
    ): Promise<EcashMintResult> => {
      try {
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
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(errorMessage)
        throw error
      }
    },
    [addProofs, removeMintQuote, updateMintBalance, proofs, updateTransaction]
  )

  const createMeltQuoteHandler = useCallback(
    async (mintUrl: string, invoice: string): Promise<MeltQuote> => {
      try {
        const quote = await createMeltQuote(mintUrl, invoice)
        addMeltQuote(quote)
        return quote
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(errorMessage)
        throw error
      }
    },
    [addMeltQuote]
  )

  const meltProofsHandler = useCallback(
    async (
      mintUrl: string,
      quote: MeltQuote,
      proofsToMelt: EcashProof[],
      description?: string
    ): Promise<EcashMeltResult> => {
      try {
        const result = await meltProofs(mintUrl, quote, proofsToMelt)
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
          id: `melt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'melt',
          amount: quote.amount,
          mintUrl,
          timestamp: new Date().toISOString(),
          status: 'settled',
          invoice: quote.quote, // Store the invoice for reference
          quoteId: quote.quote,
          expiry: quote.expiry,
          label: description, // Use description as the transaction label
          memo: description // Also store as memo for backward compatibility
        })

        toast.success(t('ecash.success.tokensMelted'))
        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(errorMessage)
        throw error
      }
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
          id: `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'send',
          amount,
          memo,
          mintUrl,
          timestamp: new Date().toISOString(),
          token: result.token
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
          // Clear all proofs from the store since they may be invalid
          // The user will need to reconnect to the mint to get fresh proofs
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
          id: `receive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'receive',
          amount: result.totalAmount,
          mintUrl,
          timestamp: new Date().toISOString(),
          status: 'completed',
          tokenStatus: 'unspent',
          memo: result.memo,
          label: result.memo
        })

        toast.success(t('ecash.success.tokenRedeemed'))
        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')

        // Add failed transaction record
        addTransaction({
          id: `receive_failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'receive',
          amount: 0, // Unknown amount for failed transactions
          mintUrl,
          timestamp: new Date().toISOString(),
          status: 'failed',
          memo: errorMessage,
          label: `Failed: ${errorMessage}`
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
    (backupData: any) => {
      try {
        restoreFromBackup(backupData)
        toast.success(t('ecash.success.backupRestored'))
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : t('ecash.error.backupRestore')
        toast.error(errorMessage)
        throw error
      }
    },
    [restoreFromBackup]
  )

  const clearAllDataHandler = useCallback(() => {
    clearAllData()
    toast.success(t('ecash.success.dataCleared'))
  }, [clearAllData])

  const resumePollingForTransaction = useCallback(
    async (
      transactionId: string,
      startPolling: (pollFunction: () => Promise<any>) => void
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
    // State
    mints,
    activeMint,
    proofs,
    transactions,
    mintQuotes,

    // Actions
    connectToMint: connectToMintHandler,
    disconnectMint,
    createMintQuote: createMintQuoteHandler,
    checkMintQuote: checkMintQuoteHandler,
    mintProofs: mintProofsHandler,
    createMeltQuote: createMeltQuoteHandler,
    meltProofs: meltProofsHandler,
    sendEcash: sendEcashHandler,
    receiveEcash: receiveEcashHandler,
    updateTransaction,
    validateToken,
    markReceivedTokensAsSpent,
    resumePollingForTransaction,
    restoreFromBackup: restoreFromBackupHandler,
    clearAllData: clearAllDataHandler
  }
}

export function useQuotePolling() {
  const [isPolling, setIsPolling] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const [_lastPollTime, setLastPollTime] = useState(0)
  const isPollingRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const startPolling = useCallback((pollFunction: () => Promise<any>) => {
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
        currentPollCount++
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
        currentPollCount++
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

export function useMintBalance() {
  const proofs = useEcashStore((state) => state.proofs)

  const balance = proofs.reduce((sum, proof) => {
    // TODO: Implement proper mint-specific proof filtering
    // For now, assume all proofs belong to the current mint
    return sum + proof.amount
  }, 0)

  return balance
}
