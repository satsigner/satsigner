import { useCallback, useEffect, useState } from 'react'

import { MempoolOracle } from '@/api/blockchain'
import { EsploraTx } from '@/api/esplora'
import { Utxo } from '@/types/models/Utxo'

export function usePreviousTransactions(
  inputs: Map<string, Utxo>,
  depth: number = 2
) {
  const [transactions, setTransactions] = useState<Map<string, EsploraTx>>(
    new Map()
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchInputTransactions = useCallback(async () => {
    if (inputs.size === 0) return

    setLoading(true)
    setError(null)
    const oracle = new MempoolOracle('https://mutinynet.com/api')
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

            const tx = (await oracle.getTransaction(txid)) as EsploraTx
            newTransactions.set(txid, tx)

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

      setTransactions(new Map([...newTransactions.entries()].reverse()))
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch transactions')
      )
    } finally {
      setLoading(false)
    }
  }, [inputs, depth])

  useEffect(() => {
    fetchInputTransactions()
  }, [fetchInputTransactions])

  return { transactions, loading, error }
}
