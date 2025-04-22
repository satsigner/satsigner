import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import EsploraClient from '@/api/esplora'
import type { EsploraTx } from '@/api/esplora'
import { useBlockchainStore } from '@/store/blockchain'
import { usePreviousTransactionsStore } from '@/store/previousTransactions'
import type { Utxo } from '@/types/models/Utxo'
import { recalculateDepthH } from '@/utils/transaction'
import { TxDecoded } from '@/utils/txDecoded'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { type Network } from '@/types/settings/blockchain' // Import Network type

type ExtendedEsploraTx = EsploraTx & {
  depthH: number
  vin?: (EsploraTx['vin'][0] & { indexV?: number })[]
  vout?: (EsploraTx['vout'][0] & { indexV?: number; vout?: number })[]
}

export function usePreviousTransactions(
  inputs: Map<string, Utxo>,
  levelDeep: number = 2,
  skipCache: boolean = false
) {
  const [previousTransactions, addTransactions] = usePreviousTransactionsStore(
    useShallow((state) => [state.transactions, state.addTransactions])
  )
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const [transactions, setTransactions] = useState<
    Map<string, ExtendedEsploraTx>
  >(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const assignIndexV = (transactions: Map<string, ExtendedEsploraTx>) => {
    if (transactions.size === 0) {
      return transactions
    }

    // Group vins and vouts by depthH
    const vinsByDepth = new Map<number, { txid: string; index: number }[]>()
    const voutsByDepth = new Map<number, { txid: string; index: number }[]>()

    // First pass: group by depthH
    for (const [txid, tx] of transactions.entries()) {
      if (tx.vin) {
        tx.vin.forEach((_, index) => {
          if (!vinsByDepth.has(tx.depthH)) {
            vinsByDepth.set(tx.depthH, [])
          }
          vinsByDepth.get(tx.depthH)?.push({ txid, index })
        })
      }

      if (tx.vout) {
        tx.vout.forEach((_, index) => {
          if (!voutsByDepth.has(tx.depthH)) {
            voutsByDepth.set(tx.depthH, [])
          }
          voutsByDepth.get(tx.depthH)?.push({ txid, index })
        })
      }
    }

    // Second pass: assign indexV
    for (const [_depthH, vins] of vinsByDepth.entries()) {
      let currentIndex = 0
      vins.forEach(({ txid, index }) => {
        const tx = transactions.get(txid)
        if (tx?.vin?.[index]) {
          tx.vin[index] = { ...tx.vin[index], indexV: currentIndex }
          currentIndex++
        }
      })
    }

    for (const [_depthH, vouts] of voutsByDepth.entries()) {
      let currentIndex = 0
      vouts.forEach(({ txid, index }) => {
        const tx = transactions.get(txid)
        if (tx?.vout?.[index]) {
          tx.vout[index] = {
            ...tx.vout[index],
            indexV: currentIndex,
            vout: index // Set vout to the original array index
          }
          currentIndex++
        }
      })
    }

    return transactions
  }

  const fetchInputTransactions = useCallback(async () => {
    if (inputs.size === 0) return

    setLoading(true)
    setError(null)

    const currentConfig = configs[selectedNetwork]

    if (!currentConfig) {
      setError(
        new Error(
          `No blockchain configuration found for network: ${selectedNetwork}`
        )
      )
      setLoading(false)
      return
    }

    let oracle: EsploraClient | ElectrumClient | null = null

    if (currentConfig.server.backend === 'esplora') {
      oracle = new EsploraClient(currentConfig.server.url)
    } else if (currentConfig.server.backend === 'electrum') {
      // ElectrumClient requires network and potentially other options
      // Assuming currentConfig.server.url format is protocol://host:port
      const urlParts = currentConfig.server.url.match(/(.*):\/\/(.*):(.*)/)
      if (urlParts && urlParts.length === 4) {
        const protocol = urlParts[1] as 'tcp' | 'tls' | 'ssl'
        const host = urlParts[2]
        const port = parseInt(urlParts[3], 10)
        oracle = new ElectrumClient({
          host,
          port,
          protocol,
          network: selectedNetwork as Network // Cast to Network type
        })
        await (oracle as ElectrumClient).init() // Initialize Electrum client
      } else {
        setError(
          new Error(`Invalid Electrum URL format: ${currentConfig.server.url}`)
        )
        setLoading(false)
        return
      }
    } else {
      setError(
        new Error(`Unsupported backend: ${currentConfig.server.backend}`)
      )
      setLoading(false)
      return
    }

    const newTransactions = new Map<string, ExtendedEsploraTx>()
    const txidToBlockInfo = new Map<string, { height: number; time: number }>() // Map to store block height and time

    try {
      if (oracle instanceof ElectrumClient) {
        const uniqueAddresses = Array.from(
          new Set(
            Array.from(inputs.values())
              .map((input) => input.addressTo)
              .filter(Boolean)
          )
        ) as string[]
        for (const address of uniqueAddresses) {
          const history = await oracle.getAddressTransactions(address)
          for (const tx of history) {
            if (tx.height > 0) {
              // Only include confirmed transactions
              try {
                const blockTimestamp = await oracle.getBlockTimestamp(tx.height)
                txidToBlockInfo.set(tx.tx_hash, {
                  height: tx.height,
                  time: blockTimestamp
                })
              } catch {
                // console.error(`Error fetching block timestamp for height ${tx.height}:`, e); // Commented out console.error
              }
            }
          }
        }
      }

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

      // BFS approach to fetch transactions by level
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
              const cachedTx = previousTransactions[txid]
              if (cachedTx) {
                newTransactions.set(txid, { ...cachedTx, depthH: 0 })

                // Collect output addresses
                cachedTx.vout?.forEach((vout: EsploraTx['vout'][0]) => {
                  if (vout.scriptpubkey_address) {
                    allOutputAddresses.add(vout.scriptpubkey_address)
                  }
                })

                // Store input addresses
                const inputAddresses = new Set<string>()
                cachedTx.vin?.forEach((vin: EsploraTx['vin'][0]) => {
                  if (vin.prevout?.scriptpubkey_address) {
                    inputAddresses.add(vin.prevout.scriptpubkey_address)
                  }
                })
                transactionInputAddresses.set(txid, inputAddresses)

                // Queue parent transactions only if we haven't reached max levelDeep
                if (level < levelDeep && cachedTx.vin) {
                  cachedTx.vin.forEach((vin: EsploraTx['vin'][0]) => {
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

            if (!oracle) {
              setError(new Error('Blockchain oracle not initialized'))
              setLoading(false)
              return
            }

            let tx: EsploraTx | null = null
            if (currentConfig.server.backend === 'esplora') {
              tx = await (oracle as EsploraClient)
                .getTxInfo(txid)
                .catch(() => null)
            } else if (currentConfig.server.backend === 'electrum') {
              try {
                const rawTxHex = await (
                  oracle as ElectrumClient
                ).client.blockchainTransaction_get(txid, false)

                const blockInfo = txidToBlockInfo.get(txid)
                const blockHeight = blockInfo?.height || 0
                const blockTime = blockInfo?.time || 0
                const confirmed = blockHeight > 0
                const blockHash = '' // Electrum doesn't provide block hash directly in history or getBlockTimestamp result

                tx = mapElectrumTxToEsploraTx(
                  rawTxHex,
                  selectedNetwork as Network,
                  confirmed,
                  blockHeight,
                  blockHash,
                  blockTime
                )
              } catch {
                // console.error(`Error fetching or mapping Electrum transaction ${txid}:`, e) // Commented out console.error
                tx = null
              }
            }

            if (!tx) return

            newTransactions.set(txid, { ...tx, depthH: 0 })

            // Collect output addresses
            tx.vout?.forEach((vout: EsploraTx['vout'][0]) => {
              if (vout.scriptpubkey_address) {
                allOutputAddresses.add(vout.scriptpubkey_address)
              }
            })

            // Store input addresses
            const inputAddresses = new Set<string>()
            tx.vin?.forEach((vin: EsploraTx['vin'][0]) => {
              if (vin.prevout?.scriptpubkey_address) {
                inputAddresses.add(vin.prevout.scriptpubkey_address)
              }
            })
            transactionInputAddresses.set(txid, inputAddresses)

            // Queue parent transactions only if we haven't reached max levelDeep
            if (level < levelDeep && tx.vin) {
              tx.vin.forEach((vin: EsploraTx['vin'][0]) => {
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
      const filteredTransactions = new Map<string, ExtendedEsploraTx>()

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

        // Include all level 1 transactions (directly selected UTXOs)
        const isLevel1 = queue.some(
          (item) => item.txid === txid && item.level === 1
        )

        // Only include transactions that have matching addresses or are level 1
        if (hasMatchingAddress || isLevel1) {
          filteredTransactions.set(txid, tx)
        }
      }

      // Handle case when few transactions are found
      if (filteredTransactions.size === 0 && newTransactions.size > 0) {
        // If no transactions passed the filter but we have raw transactions,
        // use at least the direct transactions (level 1)
        for (const [txid, tx] of newTransactions.entries()) {
          const isLevel1 = queue.some(
            (item) => item.txid === txid && item.level === 1
          )
          if (isLevel1) {
            filteredTransactions.set(txid, tx)
          }
        }
      }

      // Now calculate depthH based on dependencies
      if (filteredTransactions.size > 0) {
        // Initialize depthH to 0 for all transactions
        for (const [txid, tx] of filteredTransactions.entries()) {
          filteredTransactions.set(txid, { ...tx, depthH: 0 })
        }

        // Map inputs to the format expected by recalculateDepthH
        const mappedInputs = new Map(
          Array.from(inputs.entries()).map(([key, utxo]) => [
            key,
            {
              value: utxo.value,
              scriptpubkey_address: utxo.addressTo || ''
            }
          ])
        )

        // Use recalculateDepthH to calculate actual dependency-based depths
        const transactionsWithDepthH = recalculateDepthH(
          filteredTransactions,
          mappedInputs
        )

        // Assign indexV to vins and vouts
        const transactionsWithIndexV = assignIndexV(transactionsWithDepthH)

        // Cache the filtered transactions
        if (transactionsWithIndexV.size > 0) {
          // Convert the array of transactions back to a Map for addTransactions
          const txMap = new Map<string, EsploraTx>()
          for (const [txid, tx] of transactionsWithIndexV.entries()) {
            txMap.set(txid, tx)
          }
          addTransactions(txMap)

          // Update state
          setTransactions(transactionsWithIndexV)
        }
      } else {
        setTransactions(new Map())
      }

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setLoading(false)
    }
  }, [inputs, selectedNetwork, configs, levelDeep, skipCache, addTransactions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Helper function to map Electrum raw transaction hex to EsploraTx format
  const mapElectrumTxToEsploraTx = (
    rawTxHex: string,
    network: Network,
    confirmed: boolean,
    block_height: number,
    block_hash: string,
    block_time: number
  ): EsploraTx => {
    const decodedTx = TxDecoded.fromHex(rawTxHex)
    const txid = decodedTx.getId()
    const version = decodedTx.version
    const locktime = decodedTx.locktime
    const size = decodedTx.byteLength()
    const weight = decodedTx.weight()
    const fee = 0 // Electrum raw tx doesn't include fee directly, would need to calculate

    // Map vin
    const vin = decodedTx.ins.map((input) => ({
      txid: input.hash.reverse().toString('hex'), // TxDecoded hash is reversed
      vout: input.index,
      prevout: {
        scriptpubkey: '', // Not available in TxDecoded vin
        scriptpubkey_asm: '', // Not available in TxDecoded vin
        scriptpubkey_type: '', // Not available in TxDecoded vin
        scriptpubkey_address: '', // Not available in TxDecoded vin
        value: 0 // Not available in TxDecoded vin
      },
      scriptsig: input.script.toString('hex'),
      scriptsig_asm: '', // Not available in TxDecoded vin
      witness: input.witness.map((w) => w.toString('hex')),
      is_coinbase:
        input.hash.toString('hex') ===
          '0000000000000000000000000000000000000000000000000000000000000000' &&
        input.index === 0xffffffff, // Check for coinbase
      sequence: input.sequence
    }))

    // Map vout
    const vout = decodedTx.outs.map((output, index) => ({
      scriptpubkey: output.script.toString('hex'),
      scriptpubkey_asm: '', // Not available in TxDecoded vout
      scriptpubkey_type: '', // Not available in TxDecoded vout
      scriptpubkey_address:
        decodedTx.generateOutputScriptAddress(
          index,
          bitcoinjsNetwork(network)
        ) || '', // Use helper to get address and convert network string
      value: output.value,
      n: index
    }))

    // Status information is now available for confirmed transactions
    const status = {
      confirmed,
      block_height,
      block_hash,
      block_time
    }

    return {
      txid,
      version,
      locktime,
      vin,
      vout,
      size,
      weight,
      fee,
      status
    }
  }

  useEffect(() => {
    fetchInputTransactions()
  }, [fetchInputTransactions])

  return { transactions, loading, error, fetchInputTransactions }
}
