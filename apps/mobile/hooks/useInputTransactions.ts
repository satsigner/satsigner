import * as bitcoinjs from "bitcoinjs-lib"; // Added for network definitions
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import ElectrumClient from "@/api/electrum";
import Esplora from "@/api/esplora";
import { useBlockchainStore } from "@/store/blockchain";
import type { Transaction } from "@/types/models/Transaction";
import type { Utxo } from "@/types/models/Utxo";
import { recalculateDepthH } from "@/utils/transaction";
import { TxDecoded } from "@/utils/txDecoded";

// Define the extended Vin type
type ExtendedVin = Transaction["vin"][number] & {
  address: string;
  index?: number; // Add optional index
};

// Define the ExtendedVout type with optional index and vout
type ExtendedVout = Transaction["vout"][number] & {
  index?: number;
  vout?: number; // Add optional vout index
};

// Define the ExtendedTransaction type using Omit and intersection
export type ExtendedTransaction = Omit<Transaction, "vin" | "vout"> & {
  depthH: number;
  vin: ExtendedVin[];
  vout: ExtendedVout[]; // Use ExtendedVout
};

export function useInputTransactions(inputs: Map<string, Utxo>, levelDeep = 2) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  );

  const { server } = configs[selectedNetwork];

  const [transactions, setTransactions] = useState<
    Map<string, ExtendedTransaction>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const assignIOIndex = (transactions: Map<string, ExtendedTransaction>) => {
    if (transactions.size === 0) {
      return transactions;
    }

    // Group vins and vouts by depthH
    const vinsByDepth = new Map<number, { txid: string; index: number }[]>();
    const voutsByDepth = new Map<number, { txid: string; index: number }[]>();

    // First pass: group by depthH
    for (const [txid, tx] of transactions.entries()) {
      if (tx.vin) {
        for (const [index] of tx.vin.entries()) {
          if (!vinsByDepth.has(tx.depthH)) {
            vinsByDepth.set(tx.depthH, []);
          }
          vinsByDepth.get(tx.depthH)?.push({ index, txid });
        }
      }

      if (tx.vout) {
        for (const [index] of tx.vout.entries()) {
          if (!voutsByDepth.has(tx.depthH)) {
            voutsByDepth.set(tx.depthH, []);
          }
          voutsByDepth.get(tx.depthH)?.push({ index, txid });
        }
      }
    }

    // Second pass: assign index
    for (const [_depthH, vins] of vinsByDepth.entries()) {
      let currentIndex = 0;
      for (const { txid, index } of vins) {
        const tx = transactions.get(txid);
        if (tx?.vin?.[index]) {
          tx.vin[index] = { ...tx.vin[index], index: currentIndex };
          currentIndex += 1;
        }
      }
    }

    for (const [_depthH, vouts] of voutsByDepth.entries()) {
      let currentIndex = 0;
      for (const { txid, index } of vouts) {
        const tx = transactions.get(txid);
        if (tx?.vout?.[index]) {
          tx.vout[index] = {
            ...tx.vout[index],
            index: currentIndex,
            vout: index, // Set vout to the original array index
          };
          currentIndex += 1;
        }
      }
    }

    return transactions;
  };

  const fetchInputTransactions = useCallback(async () => {
    if (inputs.size === 0) {
      setTransactions(new Map());
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    function normalizeTxid(id: string): string {
      return id.trim().toLowerCase();
    }

    /** Wire-order outpoint hash → explorer / Electrum txid (Hermes: no TypedArray#toReversed). */
    function outpointHashBytesToTxid(hash: Uint8Array): string {
      // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
      return normalizeTxid(Buffer.from(hash).reverse().toString("hex"));
    }

    const levelOneTxids = new Set(
      Array.from(inputs.values()).map((u) => normalizeTxid(u.txid))
    );

    const newTransactions = new Map<string, ExtendedTransaction>();
    const queue = Array.from(inputs.values()).map((input) => ({
      level: 1,
      txid: normalizeTxid(input.txid),
    }));
    const processed = new Set<string>();
    let currentLevelDeep = 0;

    // Store all output addresses from all transactions
    const allOutputAddresses = new Set<string>();
    // Store transactions with their input addresses
    const transactionInputAddresses = new Map<string, Set<string>>();

    let electrumClient: ElectrumClient | null = null; // Declare client variable

    async function fetchElectrumTxRaw(
      txId: string
    ): Promise<string | undefined> {
      if (!electrumClient) {
        return undefined;
      }
      const id = normalizeTxid(txId);
      const candidates: string[] = [id];
      if (/^[a-f0-9]{64}$/i.test(id) && Buffer.from(id, "hex").length === 32) {
        candidates.push(
          // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
          Buffer.from(id, "hex").reverse().toString("hex").toLowerCase()
        );
      }
      for (const candidate of candidates) {
        try {
          const raw = await electrumClient.getTransaction(candidate);
          if (raw && typeof raw === "string" && raw.length > 0) {
            return raw;
          }
        } catch {
          continue;
        }
      }
      return undefined;
    }

    try {
      // Initialize client once if backend is Electrum
      if (server.backend === "electrum") {
        electrumClient = ElectrumClient.fromUrl(server.url, server.network);
        await electrumClient.init();
      }

      while (currentLevelDeep < levelDeep && queue.length > 0) {
        const targetLevel = currentLevelDeep + 1;
        const currentLevelTxids = queue.filter(
          (item) => item.level === targetLevel
        );
        if (currentLevelTxids.length === 0) {
          break;
        }

        await Promise.all(
          // eslint-disable-next-line no-loop-func
          currentLevelTxids.map(async ({ txid, level }) => {
            if (processed.has(txid)) {
              return;
            }
            processed.add(txid);

            let tx;
            if (server.backend === "esplora") {
              const esploraClient = new Esplora(server.url);
              tx = await esploraClient.getTxInfo(txid).catch(() => null);
              if (
                !tx &&
                /^[a-fA-F0-9]{64}$/i.test(txid) &&
                Buffer.from(txid, "hex").length === 32
              ) {
                const reversed =
                  // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
                  Buffer.from(txid, "hex").reverse().toString("hex");
                tx = await esploraClient.getTxInfo(reversed).catch(() => null);
              }
              // Map EsploraTx to Transaction type structure

              if (tx) {
                const mappedTx: Transaction = {
                  address: undefined, // Not directly available in EsploraTx
                  blockHeight: tx.status.block_height,
                  fee: tx.fee,
                  id: txid,
                  label: undefined, // TODO: add label
                  lockTime: tx.locktime,
                  lockTimeEnabled: tx.locktime > 0,
                  prices: {},
                  raw: undefined, // Not directly available in EsploraTx
                  received: 0, // Not needed
                  sent: 0, // Not needed
                  size: tx.size,
                  timestamp: tx.status.block_time
                    ? new Date(tx.status.block_time)
                    : undefined,
                  type: "send", // Not needed
                  version: tx.version,
                  vin: tx.vin.map((input) => ({
                    address: input.prevout?.scriptpubkey_address,
                    label: undefined, // TODO: add label
                    previousOutput: {
                      txid: normalizeTxid(input.txid),
                      vout: input.vout,
                    },
                    scriptSig: input.scriptsig
                      ? Array.from(Buffer.from(input.scriptsig, "hex"))
                      : [],
                    sequence: input.sequence,
                    value: input.prevout?.value,
                    witness: input.witness
                      ? input.witness.map((w) =>
                          Array.from(Buffer.from(w, "hex"))
                        )
                      : [],
                  })),
                  vout: tx.vout.map((output) => ({
                    address: output.scriptpubkey_address,
                    label: undefined,
                    script: output.scriptpubkey
                      ? Array.from(Buffer.from(output.scriptpubkey, "hex"))
                      : [],
                    value: output.value, // TODO: add label
                  })),
                  vsize: Math.ceil(tx.size * 0.25), // Calculate vsize as weight/4
                  weight: tx.weight,
                };
                newTransactions.set(txid, {
                  ...(mappedTx as ExtendedTransaction),
                  depthH: 0,
                });

                // Collect output addresses
                for (const vout of mappedTx.vout ?? []) {
                  if (vout.address) {
                    allOutputAddresses.add(vout.address);
                  }
                }

                // Store input addresses
                const inputAddresses = new Set<string>();
                // Extract input addresses from the vin array's prevout field
                for (const vin of tx.vin ?? []) {
                  if (vin.prevout?.scriptpubkey_address) {
                    inputAddresses.add(vin.prevout.scriptpubkey_address);
                  }
                }
                transactionInputAddresses.set(txid, inputAddresses);
              }
            } else if (server.backend === "electrum" && electrumClient) {
              // Check if electrumClient is initialized
              try {
                let blockHeight: number | undefined = undefined;
                let timestamp: Date | undefined = undefined;
                const rawHex = await fetchElectrumTxRaw(txid);
                if (rawHex && rawHex.length > 0) {
                  const parsedTx = TxDecoded.fromHex(rawHex);

                  // Try to get block height by deriving an address from outputs and checking history
                  // Derive an address from the transaction outputs if possible
                  for (const output of parsedTx.outs) {
                    try {
                      const address = output.script
                        ? bitcoinjs.address.fromOutputScript(
                            output.script,
                            selectedNetwork === "bitcoin"
                              ? bitcoinjs.networks.bitcoin
                              : bitcoinjs.networks.testnet
                          )
                        : null;
                      if (address) {
                        // Get transaction history for this address
                        const history =
                          await electrumClient.client.blockchainScripthash_getHistory(
                            electrumClient.addressToScriptHash(address)
                          );
                        // Look for our transaction in the history
                        const txEntry = history.find(
                          (entry: { tx_hash: string; height: number }) =>
                            normalizeTxid(entry.tx_hash) === txid
                        );
                        if (txEntry && txEntry.height) {
                          blockHeight = txEntry.height;
                          break; // Found the height, no need to check other addresses
                        }
                      }
                    } catch {
                      /* silently ignored */
                    }
                  }
                  if (blockHeight) {
                    timestamp = new Date(
                      await electrumClient.getBlockTimestamp(blockHeight)
                    );
                  }
                  // Collect previous transaction IDs needed for input values
                  const prevTxOutputs = parsedTx.ins.map((input) => ({
                    txid: outpointHashBytesToTxid(input.hash),
                    vout: input.index,
                  }));
                  const uniquePrevTxids = [
                    ...new Set(prevTxOutputs.map((p) => p.txid)),
                  ];

                  // Fetch each prev tx separately: batch getTransactions aborts
                  // the whole map if any single blockchainTransaction_get throws.
                  const prevTxsMap = new Map<string, TxDecoded>();
                  for (const prevId of uniquePrevTxids) {
                    const rawPrev = await fetchElectrumTxRaw(prevId);
                    if (!rawPrev) {
                      continue;
                    }
                    try {
                      prevTxsMap.set(prevId, TxDecoded.fromHex(rawPrev));
                    } catch {
                      /* Failed to parse, skip this one */
                    }
                  }

                  const bjsNetwork =
                    selectedNetwork === "bitcoin"
                      ? bitcoinjs.networks.bitcoin
                      : bitcoinjs.networks.testnet;

                  const outputScriptToAddress = (script: Buffer): string => {
                    try {
                      return bitcoinjs.address.fromOutputScript(
                        script,
                        bjsNetwork
                      );
                    } catch {
                      return "";
                    }
                  };

                  // Map parsed Electrum transaction to Transaction type structure
                  const mappedTx: Transaction = {
                    address: undefined, // Not directly available in raw tx
                    blockHeight,
                    fee: undefined, // Not directly available in raw tx
                    id: txid,
                    label: undefined, // TODO: add label
                    lockTime: parsedTx.locktime,
                    lockTimeEnabled: parsedTx.locktime > 0,
                    prices: {},
                    raw: Array.from(Buffer.from(rawHex, "hex")),
                    received: 0, // Not needed
                    sent: 0, // Not needed
                    size: parsedTx.byteLength(),
                    timestamp,
                    type: "send", // Not needed
                    version: parsedTx.version,
                    vin: parsedTx.ins.map((input) => {
                      const prevTxid = outpointHashBytesToTxid(input.hash);
                      const prevVout = input.index;
                      const prevTx = prevTxsMap.get(prevTxid);
                      const value = prevTx?.outs[prevVout]?.value; // Get value from prev tx output

                      let address = "unknown";
                      if (prevTx) {
                        // Ensure prevTx.outs[prevVout].script is a Buffer
                        // TxDecoded stores script as Buffer, so direct use should be fine.
                        address =
                          prevTx.generateOutputScriptAddress(
                            prevVout,
                            bjsNetwork
                          ) || "unknown";
                      }

                      return {
                        address, // Assign derived address
                        label: undefined, // TODO: add label
                        previousOutput: {
                          txid: prevTxid,
                          vout: prevVout,
                        },
                        scriptSig: Array.from(input.script),
                        sequence: input.sequence,
                        value, // Assign fetched value
                        witness: input.witness.map((w) => Array.from(w)),
                      };
                    }),
                    vout: parsedTx.outs.map((output) => ({
                      address: output.script
                        ? outputScriptToAddress(output.script)
                        : "",
                      label: undefined, // TODO: add label
                      script: Array.from(output.script),
                      value: output.value,
                    })),
                    vsize: parsedTx.virtualSize(),
                    weight: parsedTx.weight(),
                  };

                  newTransactions.set(txid, {
                    ...(mappedTx as ExtendedTransaction),
                    depthH: 0,
                  });

                  const inputAddresses = new Set<string>();
                  for (const vin of mappedTx.vin as ExtendedVin[]) {
                    if (vin.address && vin.address !== "unknown") {
                      inputAddresses.add(vin.address);
                    }
                  }
                  for (const vout of mappedTx.vout ?? []) {
                    if (vout.address) {
                      allOutputAddresses.add(vout.address);
                    }
                  }
                  transactionInputAddresses.set(txid, inputAddresses);
                }
              } catch {
                /* Electrum path failed for this txid */
              }
            }

            const storedTx = newTransactions.get(txid);
            const coinbasePrevTxid = "0".repeat(64);
            if (level < levelDeep && storedTx?.vin) {
              for (const vin of storedTx.vin) {
                const parentTxid = normalizeTxid(vin.previousOutput.txid);
                const isCoinbaseInput =
                  !parentTxid ||
                  parentTxid === coinbasePrevTxid ||
                  parentTxid.length !== 64;
                if (
                  !isCoinbaseInput &&
                  !processed.has(parentTxid) &&
                  !queue.some((item) => item.txid === parentTxid)
                ) {
                  queue.push({
                    level: level + 1,
                    txid: parentTxid,
                  });
                }
              }
            }
          })
        );

        currentLevelDeep += 1;
      }

      // Filter transactions based on input/output address matching
      const filteredTransactions = new Map<string, ExtendedTransaction>();

      // First, collect all valid transactions
      for (const [txid, tx] of newTransactions.entries()) {
        const inputAddresses =
          transactionInputAddresses.get(txid) ?? new Set<string>();

        // Check if any input address matches with output addresses from other transactions
        let hasMatchingAddress = false;
        for (const inputAddr of inputAddresses) {
          if (allOutputAddresses.has(inputAddr)) {
            hasMatchingAddress = true;
            break;
          }
        }

        // Include all level 1 transactions (directly selected UTXOs)
        const isLevel1 = levelOneTxids.has(txid);

        // Only include transactions that have matching addresses or are level 1
        if (hasMatchingAddress || isLevel1) {
          filteredTransactions.set(txid, tx);
        }
      }

      // Handle case when few transactions are found
      if (filteredTransactions.size === 0 && newTransactions.size > 0) {
        // If no transactions passed the filter but we have raw transactions,
        // use at least the direct transactions (level 1)
        for (const [txid, tx] of newTransactions.entries()) {
          if (levelOneTxids.has(txid)) {
            filteredTransactions.set(txid, tx);
          }
        }
      }

      // Now calculate depthH based on dependencies
      if (filteredTransactions.size > 0) {
        // Initialize depthH to 0 for all transactions
        for (const [txid, tx] of filteredTransactions.entries()) {
          filteredTransactions.set(txid, { ...tx, depthH: 0 });
        }

        // Map inputs to the format expected by recalculateDepthH
        const mappedInputs = new Map(
          Array.from(inputs.entries()).map(([key, utxo]) => [
            key,
            {
              scriptpubkey_address: utxo.addressTo || "",
              value: utxo.value,
            },
          ])
        );

        // Use recalculateDepthH to calculate actual dependency-based depths
        const transactionsWithDepthH = recalculateDepthH(
          filteredTransactions,
          mappedInputs
        );

        // Assign index to vins and vouts
        const transactionsWithIOIndex = assignIOIndex(transactionsWithDepthH);

        // Update state
        setTransactions(transactionsWithIOIndex);
      } else {
        setTransactions(new Map());
      }

      setLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)));
      setLoading(false);
    } finally {
      // Ensure client is closed if it was initialized
      if (electrumClient) {
        electrumClient.close();
      }
    }
  }, [inputs, server, levelDeep, selectedNetwork]);

  useEffect(() => {
    fetchInputTransactions();
  }, [fetchInputTransactions]);

  return { error, fetchInputTransactions, loading, transactions };
}
