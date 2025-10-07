import { useCallback, useEffect, useState } from 'react'
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
  type MeltQuote,
  type MintQuote,
  type MintQuoteState
} from '@/types/models/Ecash'

const POLL_INTERVAL = 1500 // 1.5 seconds
const MAX_POLL_ATTEMPTS = 120 // 3 minutes max

export function useEcash() {
  const mints = useEcashStore((state) => state.mints)
  const activeMint = useEcashStore((state) => state.activeMint)
  const proofs = useEcashStore((state) => state.proofs)
  const transactions = useEcashStore((state) => state.transactions)
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
    async (mintUrl: string, amount: number): Promise<MintQuote> => {
      try {
        const quote = await createMintQuote(mintUrl, amount)
        addMintQuote(quote)
        return quote
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(errorMessage)
        throw error
      }
    },
    [addMintQuote]
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

        // Add transaction record
        addTransaction({
          id: `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'mint',
          amount,
          mintUrl,
          timestamp: new Date().toISOString(),
          quoteId
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
    [addProofs, removeMintQuote, updateMintBalance, proofs]
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
      proofsToMelt: EcashProof[]
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

        // Add transaction record
        addTransaction({
          id: `melt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'melt',
          amount: quote.amount,
          mintUrl,
          timestamp: new Date().toISOString(),
          invoice: quote.quote, // Store the invoice for reference
          quoteId: quote.quote
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
    [removeProofs, removeMeltQuote, addProofs, updateMintBalance, proofs]
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
        toast.error(errorMessage)
        throw error
      }
    },
    [proofs, removeProofs, addProofs, updateMintBalance]
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
          timestamp: new Date().toISOString()
        })

        toast.success(t('ecash.success.tokenRedeemed'))
        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('ecash.error.networkError')
        toast.error(errorMessage)
        throw error
      }
    },
    [addProofs, updateMintBalance, proofs]
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

  return {
    // State
    mints,
    activeMint,
    proofs,
    transactions,

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
    restoreFromBackup: restoreFromBackupHandler,
    clearAllData: clearAllDataHandler
  }
}

export function useQuotePolling() {
  const [isPolling, setIsPolling] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const [lastPollTime, setLastPollTime] = useState(0)

  const startPolling = useCallback(
    (pollFunction: () => Promise<any>) => {
      setIsPolling(true)
      setPollCount(0)
      setLastPollTime(Date.now())

      const poll = async () => {
        if (pollCount >= MAX_POLL_ATTEMPTS) {
          setIsPolling(false)
          return
        }

        const now = Date.now()
        if (now - lastPollTime < POLL_INTERVAL) {
          setTimeout(poll, POLL_INTERVAL - (now - lastPollTime))
          return
        }

        try {
          await pollFunction()
          setPollCount((prev) => prev + 1)
          setLastPollTime(now)

          if (isPolling) {
            setTimeout(poll, POLL_INTERVAL)
          }
        } catch (error) {
          setIsPolling(false)
          throw error
        }
      }

      poll()
    },
    [pollCount, lastPollTime, isPolling]
  )

  const stopPolling = useCallback(() => {
    setIsPolling(false)
    setPollCount(0)
  }, [])

  return {
    isPolling,
    pollCount,
    startPolling,
    stopPolling
  }
}

export function useMintBalance(mintUrl: string) {
  const proofs = useEcashStore((state) => state.proofs)

  const balance = proofs.reduce((sum, proof) => {
    // TODO: Implement proper mint-specific proof filtering
    // For now, assume all proofs belong to the current mint
    return sum + proof.amount
  }, 0)

  return balance
}
