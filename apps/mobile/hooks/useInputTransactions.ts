import * as bitcoinjs from 'bitcoinjs-lib' // Added for network definitions
import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { useBlockchainStore } from '@/store/blockchain'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'
import { recalculateDepthH } from '@/utils/transaction'
import { TxDecoded } from '@/utils/txDecoded'

// Define the extended Vin type
type ExtendedVin = Transaction['vin'][number] & {
  address: string
  index?: number // Add optional index
}

// Define the ExtendedVout type with optional index and vout
type ExtendedVout = Transaction['vout'][number] & {
  index?: number
  vout?: number // Add optional vout index
}

// Define the ExtendedTransaction type using Omit and intersection
export type ExtendedTransaction = Omit<Transaction, 'vin' | 'vout'> & {
  depthH: number
  vin: ExtendedVin[]
  vout: ExtendedVout[] // Use ExtendedVout
}

export function useInputTransactions(
  inputs: Map<string, Utxo>,
  levelDeep: number = 2
) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const { server } = configs[selectedNetwork]

  const [transactions, setTransactions] = useState<
    Map<string, ExtendedTransaction>
  >(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const assignIOIndex = (transactions: Map<string, ExtendedTransaction>) => {
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

    // Second pass: assign index
    for (const [_depthH, vins] of vinsByDepth.entries()) {
      let currentIndex = 0
      vins.forEach(({ txid, index }) => {
        const tx = transactions.get(txid)
        if (tx?.vin?.[index]) {
          tx.vin[index] = { ...tx.vin[index], index: currentIndex }
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
            index: currentIndex,
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

    const newTransactions = new Map<string, ExtendedTransaction>()
    const queue = Array.from(inputs.values()).map((input) => ({
      txid: input.txid,
      level: 1
    }))
    const processed = new Set<string>()
    let currentLevelDeep = 0

    // Store all output addresses from all transactions
    const allOutputAddresses = new Set<string>()
    // Store transactions with their input addresses
    const transactionInputAddresses = new Map<string, Set<string>>()

    let electrumClient: ElectrumClient | null = null // Declare client variable

    try {
      // Initialize client once if backend is Electrum
      if (server.backend === 'electrum') {
        electrumClient = ElectrumClient.fromUrl(server.url, server.network)
        await electrumClient.init()
      }

      while (currentLevelDeep < levelDeep && queue.length > 0) {
        const currentLevelTxids = queue.filter(
          (item) => item.level === currentLevelDeep + 1
        )
        if (currentLevelTxids.length === 0) break

        await Promise.all(
          currentLevelTxids.map(async ({ txid, level }) => {
            if (processed.has(txid)) return
            processed.add(txid)

            let tx
            if (server.backend === 'esplora') {
              const esploraClient = new Esplora(server.url)
              tx = await esploraClient.getTxInfo(txid).catch(() => null)
              // Map EsploraTx to Transaction type structure

              if (tx) {
                const mappedTx: Transaction = {
                  id: tx.txid,
                  type: 'send', // Not needed
                  sent: 0, // Not needed
                  received: 0, // Not needed
                  timestamp: tx.status.block_time
                    ? new Date(tx.status.block_time)
                    : undefined,
                  blockHeight: tx.status.block_height,
                  address: undefined, // Not directly available in EsploraTx
                  label: undefined, // TODO: add label
                  fee: tx.fee,
                  size: tx.size,
                  vsize: Math.ceil(tx.size * 0.25), // Calculate vsize as weight/4
                  weight: tx.weight,
                  version: tx.version,
                  lockTime: tx.locktime,
                  lockTimeEnabled: tx.locktime > 0,
                  raw: undefined, // Not directly available in EsploraTx
                  vin: tx.vin.map((input) => ({
                    previousOutput: {
                      txid: input.txid,
                      vout: input.vout
                    },
                    sequence: input.sequence,
                    scriptSig: input.scriptsig
                      ? Array.from(Buffer.from(input.scriptsig, 'hex'))
                      : [],
                    witness: input.witness
                      ? input.witness.map((w) =>
                          Array.from(Buffer.from(w, 'hex'))
                        )
                      : [],
                    value: input.prevout?.value,
                    label: undefined, // TODO: add label
                    address: input.prevout?.scriptpubkey_address
                  })),
                  vout: tx.vout.map((output) => ({
                    value: output.value,
                    address: output.scriptpubkey_address,
                    script: output.scriptpubkey
                      ? Array.from(Buffer.from(output.scriptpubkey, 'hex'))
                      : [],
                    label: undefined // TODO: add label
                  })),
                  prices: {}
                }
                newTransactions.set(txid, {
                  ...(mappedTx as ExtendedTransaction),
                  depthH: 0
                })

                // Collect output addresses
                mappedTx.vout?.forEach((vout) => {
                  if (vout.address) {
                    allOutputAddresses.add(vout.address)
                  }
                })

                // Store input addresses
                const inputAddresses = new Set<string>()
                // Extract input addresses from the vin array's prevout field
                tx.vin?.forEach((vin) => {
                  if (vin.prevout?.scriptpubkey_address) {
                    inputAddresses.add(vin.prevout.scriptpubkey_address)
                  }
                })
                transactionInputAddresses.set(txid, inputAddresses)
              }
            } else if (server.backend === 'electrum' && electrumClient) {
              // Check if electrumClient is initialized
              try {
                let blockHeight: number | undefined = undefined
                let timestamp: Date | undefined = undefined
                // Use the single, initialized electrumClient
                const rawTx = await electrumClient.getTransactions([txid])
                if (rawTx && rawTx.length > 0) {
                  const parsedTx = TxDecoded.fromHex(rawTx[0])

                  // Try to get block height by deriving an address from outputs and checking history
                  // Derive an address from the transaction outputs if possible
                  for (const output of parsedTx.outs) {
                    try {
                      const address = output.script
                        ? bitcoinjs.address.fromOutputScript(
                            output.script,
                            selectedNetwork === 'bitcoin'
                              ? bitcoinjs.networks.bitcoin
                              : bitcoinjs.networks.testnet
                          )
                        : null
                      if (address) {
                        // Get transaction history for this address
                        const history =
                          await electrumClient.client.blockchainScripthash_getHistory(
                            electrumClient.addressToScriptHash(address)
                          )
                        // Look for our transaction in the history
                        const txEntry = history.find(
                          (entry: { tx_hash: string; height: number }) =>
                            entry.tx_hash === txid
                        )
                        if (txEntry && txEntry.height) {
                          blockHeight = txEntry.height
                          break // Found the height, no need to check other addresses
                        }
                      }
                    } catch (_addrError) {}
                  }
                  if (blockHeight) {
                    timestamp = new Date(
                      await electrumClient.getBlockTimestamp(blockHeight)
                    )
                  }
                  // Collect previous transaction IDs needed for input values
                  const prevTxOutputs = parsedTx.ins.map((input) => ({
                    txid: input.hash.slice().reverse().toString('hex'),
                    vout: input.index
                  }))
                  const uniquePrevTxids = [
                    ...new Set(prevTxOutputs.map((p) => p.txid))
                  ]

                  const rawPrevTxs =
                    await electrumClient.getTransactions(uniquePrevTxids)

                  // Parse previous transactions and store in a map
                  const prevTxsMap = new Map<string, TxDecoded>()
                  if (rawPrevTxs) {
                    rawPrevTxs.forEach((rawPrevTx, index) => {
                      const currentTxidForMap = uniquePrevTxids[index]
                      if (rawPrevTx) {
                        try {
                          const parsedPrevTx = TxDecoded.fromHex(rawPrevTx)
                          prevTxsMap.set(currentTxidForMap, parsedPrevTx)
                        } catch (_parseError) {
                          // Failed to parse, skip this one
                        }
                      }
                    })
                  }
                  // Map parsed Electrum transaction to Transaction type structure
                  const mappedTx: Transaction = {
                    id: txid,
                    type: 'send', // Not needed
                    sent: 0, // Not needed
                    received: 0, // Not needed
                    timestamp,
                    blockHeight,
                    address: undefined, // Not directly available in raw tx
                    label: undefined, // TODO: add label
                    fee: undefined, // Not directly available in raw tx
                    size: parsedTx.byteLength(),
                    vsize: parsedTx.virtualSize(),
                    weight: parsedTx.weight(),
                    version: parsedTx.version,
                    lockTime: parsedTx.locktime,
                    lockTimeEnabled: parsedTx.locktime > 0,
                    raw: Array.from(Buffer.from(rawTx[0], 'hex')),
                    vin: parsedTx.ins.map((input) => {
                      const prevTxid = input.hash.toString('hex') // input.hash is now little-endian here
                      const prevVout = input.index
                      const prevTx = prevTxsMap.get(prevTxid)
                      const value = prevTx?.outs[prevVout]?.value // Get value from prev tx output

                      let address = 'unknown'
                      if (prevTx) {
                        const bjsNetwork =
                          selectedNetwork === 'bitcoin'
                            ? bitcoinjs.networks.bitcoin
                            : bitcoinjs.networks.testnet
                        // Ensure prevTx.outs[prevVout].script is a Buffer
                        // TxDecoded stores script as Buffer, so direct use should be fine.
                        address =
                          prevTx.generateOutputScriptAddress(
                            prevVout,
                            bjsNetwork
                          ) || 'unknown'
                      }

                      return {
                        previousOutput: {
                          txid: prevTxid,
                          vout: prevVout
                        },
                        sequence: input.sequence,
                        scriptSig: Array.from(input.script),
                        witness: input.witness.map((w) => Array.from(w)),
                        value, // Assign fetched value
                        label: undefined, // TODO: add label
                        address // Assign derived address
                      }
                    }),
                    vout: parsedTx.outs.map((output) => ({
                      value: output.value,
                      address: '', // Set to empty string to satisfy required string type
                      script: Array.from(output.script),
                      label: undefined // TODO: add label
                    })),
                    prices: {}
                  }

                  newTransactions.set(txid, {
                    ...(mappedTx as ExtendedTransaction),
                    depthH: 0
                  })

                  // Store input addresses (will need to fetch previous transactions for Electrum)
                  const inputAddresses = new Set<string>()
                  // Skipping for now
                  transactionInputAddresses.set(txid, inputAddresses)
                }
              } catch (_electrumError) {}
            }

            // Queue parent transactions only if we haven't reached max levelDeep
            if (level < levelDeep && tx?.vin) {
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
      const filteredTransactions = new Map<string, ExtendedTransaction>()

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

        // Assign index to vins and vouts
        const transactionsWithIOIndex = assignIOIndex(transactionsWithDepthH)

        // Update state
        setTransactions(transactionsWithIOIndex)
      } else {
        setTransactions(new Map())
      }

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setLoading(false)
    } finally {
      // Ensure client is closed if it was initialized
      if (electrumClient) {
        electrumClient.close()
      }
    }
  }, [inputs, server, levelDeep, selectedNetwork])

  useEffect(() => {
    fetchInputTransactions()
  }, [fetchInputTransactions])

  return { transactions, loading, error, fetchInputTransactions }
}
