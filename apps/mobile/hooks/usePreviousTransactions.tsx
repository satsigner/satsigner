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
  depth: number = 2,
  skipCache: boolean = true
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

  const [transactions, setTransactions] = useState<Map<string, EsploraTx>>(
    new Map()
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { addTransactions, getTransaction } = usePreviousTransactionsStore()

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

    const newTransactions = new Map<string, EsploraTx>()

    try {
      const queue = Array.from(inputs.values()).map((input) => input.txid)
      const processed = new Set<string>()
      let currentDepth = 0

      while (currentDepth < depth && queue.length > 0) {
        const currentLevelTxids = [...queue]
        queue.length = 0 // Clear the queue for the next level

        await Promise.all(
          currentLevelTxids.map(async (txid) => {
            if (processed.has(txid)) return
            processed.add(txid)

            // Check cache first if skipCache is false
            if (!skipCache) {
              const cachedTx = getTransaction(txid)
              if (cachedTx) {
                newTransactions.set(txid, cachedTx)
                // Still need to check parents
                if (cachedTx.vin) {
                  cachedTx.vin.forEach((vin) => {
                    const parentTxid = vin.txid
                    if (
                      parentTxid &&
                      !processed.has(parentTxid) &&
                      !queue.includes(parentTxid)
                    ) {
                      queue.push(parentTxid)
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

            newTransactions.set(txid, tx as EsploraTx)

            // Collect parent txids for next level
            if (tx.vin) {
              tx.vin.forEach((vin) => {
                const parentTxid = vin.txid
                if (
                  parentTxid &&
                  !processed.has(parentTxid) &&
                  !queue.includes(parentTxid)
                ) {
                  queue.push(parentTxid)
                }
              })
            }
          })
        )
        currentDepth++
      }

      // Cache the new transactions
      if (newTransactions.size > 0) {
        addTransactions(newTransactions)
        setTransactions(new Map([...newTransactions.entries()].reverse()))
      }
    } catch (e) {
      const error = e as Error
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [inputs, network, depth, skipCache, getTransaction, addTransactions])

  useEffect(() => {
    fetchInputTransactions()
  }, [fetchInputTransactions])

  return { transactions, loading, error }
}
