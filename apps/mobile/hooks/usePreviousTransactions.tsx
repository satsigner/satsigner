import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import { EsploraTx } from '@/api/esplora'
import { useBlockchainStore } from '@/store/blockchain'
import { usePreviousTransactionsStore } from '@/store/previousTransactions'
import { Utxo } from '@/types/models/Utxo'

const SIGNET_URL = 'https://mempool.space/signet/api'
const TESTNET_URL = 'https://mempool.space/testnet/api'
const BITCOIN_URL = 'https://mempool.space/api'

export function usePreviousTransactions(
  inputs: Map<string, Utxo>,
  levelDeep: number = 2,
  skipCache: boolean = false
) {
  const [, network] = useBlockchainStore(
    useShallow((state) => [
      state.backend,
      state.network,
      state.retries,
      state.stopGap,
      state.timeout,
      state.url
    ])
  )

  const [transactions, setTransactions] = useState<
    Map<string, EsploraTx & { depthH: number }>
  >(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { addTransactions, getTransaction } = usePreviousTransactionsStore()

  const getInitialDepthH = (txCount: number) => {
    // For single transaction, use depth of 1
    // For two transactions, use depths of 3 and 1
    // For three or more, spread them out with max depth of 5
    return Math.min((txCount - 1) * 2 + 1, 5)
  }

  const fetchInputTransactions = useCallback(async () => {
    if (inputs.size === 0) return

    setLoading(true)
    setError(null)

    const oracle = new MempoolOracle(
      (() => {
        switch (network) {
          case 'signet':
            return SIGNET_URL
          case 'testnet':
            return TESTNET_URL
          default:
            return BITCOIN_URL
        }
      })()
    )

    const newTransactions = new Map<string, EsploraTx & { depthH: number }>()

    try {
      const queue = Array.from(inputs.values()).map((input) => ({
        txid: input.txid,
        level: 1 // Track which level in the chain this tx is
      }))
      const processed = new Set<string>()
      let currentLevelDeep = 0

      // Store all output addresses from all transactions
      const allOutputAddresses = new Set<string>()
      // Store transactions with their input addresses
      const transactionInputAddresses = new Map<string, Set<string>>()

      while (currentLevelDeep < levelDeep && queue.length > 0) {
        const currentLevelTxids = queue.filter(
          (item) => item.level === currentLevelDeep + 1
        )
        if (currentLevelTxids.length === 0) break

        await Promise.all(
          currentLevelTxids.map(async ({ txid, level }) => {
            if (processed.has(txid)) return
            processed.add(txid)

            // Check cache first if skipCache is false
            if (!skipCache) {
              const cachedTx = getTransaction(txid)
              if (cachedTx) {
                newTransactions.set(txid, { ...cachedTx, depthH: 0 })

                // Collect output addresses
                cachedTx.vout?.forEach((vout) => {
                  if (vout.scriptpubkey_address) {
                    allOutputAddresses.add(vout.scriptpubkey_address)
                  }
                })

                // Store input addresses
                const inputAddresses = new Set<string>()
                cachedTx.vin?.forEach((vin) => {
                  if (vin.prevout?.scriptpubkey_address) {
                    inputAddresses.add(vin.prevout.scriptpubkey_address)
                  }
                })
                transactionInputAddresses.set(txid, inputAddresses)

                // Queue parent transactions only if we haven't reached max levelDeep
                if (level < levelDeep && cachedTx.vin) {
                  cachedTx.vin.forEach((vin) => {
                    const parentTxid = vin.txid
                    if (
                      parentTxid &&
                      !processed.has(parentTxid) &&
                      !queue.some((item) => item.txid === parentTxid)
                    ) {
                      queue.push({
                        txid: parentTxid,
                        level: level + 1
                      })
                    }
                  })
                }
                return
              }
            }

            const tx = await oracle.getTransaction(txid).catch((err) => {
              throw new Error(
                `Failed to fetch transaction ${txid}: ${err.message}`
              )
            })

            if (!tx) {
              throw new Error(`No transaction data received for ${txid}`)
            }

            newTransactions.set(txid, { ...(tx as EsploraTx), depthH: 0 })

            // Collect output addresses
            tx.vout?.forEach((vout) => {
              if (vout.scriptpubkey_address) {
                allOutputAddresses.add(vout.scriptpubkey_address)
              }
            })

            // Store input addresses
            const inputAddresses = new Set<string>()
            tx.vin?.forEach((vin) => {
              if (vin.prevout?.scriptpubkey_address) {
                inputAddresses.add(vin.prevout.scriptpubkey_address)
              }
            })
            transactionInputAddresses.set(txid, inputAddresses)

            // Queue parent transactions only if we haven't reached max levelDeep
            if (level < levelDeep && tx.vin) {
              tx.vin.forEach((vin) => {
                const parentTxid = vin.txid
                if (
                  parentTxid &&
                  !processed.has(parentTxid) &&
                  !queue.some((item) => item.txid === parentTxid)
                ) {
                  queue.push({
                    txid: parentTxid,
                    level: level + 1
                  })
                }
              })
            }
          })
        )
        currentLevelDeep++
      }

      // Filter transactions based on input/output address matching
      const filteredTransactions = new Map<
        string,
        EsploraTx & { depthH: number }
      >()

      // First, collect all valid transactions
      for (const [txid, tx] of newTransactions.entries()) {
        const inputAddresses = transactionInputAddresses.get(txid)
        if (!inputAddresses) continue

        // Check if any input address matches with output addresses from other transactions
        let hasMatchingAddress = false
        for (const inputAddr of inputAddresses) {
          if (allOutputAddresses.has(inputAddr)) {
            hasMatchingAddress = true
            break
          }
        }

        // Only include transactions that have matching addresses
        if (hasMatchingAddress) {
          filteredTransactions.set(txid, tx)
        }
      }

      // Now calculate depthH based on actual transaction count and level
      const txCount = filteredTransactions.size
      for (const [txid, tx] of filteredTransactions.entries()) {
        const queueItem = queue.find((item) => item.txid === txid)
        if (queueItem) {
          const depthH = getInitialDepthH(txCount) - (queueItem.level - 1) * 2
          filteredTransactions.set(txid, { ...tx, depthH })
        }
      }

      // Cache the filtered transactions
      if (filteredTransactions.size > 0) {
        addTransactions(filteredTransactions)
        setTransactions(new Map([...filteredTransactions.entries()].reverse()))
      }
    } catch (e) {
      const error = e as Error
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [inputs, network, levelDeep, skipCache, getTransaction, addTransactions])

  useEffect(() => {
    fetchInputTransactions()
  }, [fetchInputTransactions])

  return { transactions, loading, error }
}
