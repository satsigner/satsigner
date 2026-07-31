import * as bitcoinjs from 'bitcoinjs-lib'

import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type PayjoinWalletCallbacks } from '@/types/payjoin'
import { filterPayjoinContributeUtxos } from '@/utils/payjoinUtxos'

function bytesToHex(bytes: number[] | Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

function utxoScriptHex(utxo: Utxo): string {
  if (!utxo.script) {
    return ''
  }
  if (typeof utxo.script === 'string') {
    return utxo.script
  }
  return bytesToHex(utxo.script)
}

function addressScriptHex(
  address: string,
  network: bitcoinjs.Network
): string | undefined {
  try {
    return bytesToHex(bitcoinjs.address.toOutputScript(address, network))
  } catch {
    return undefined
  }
}

function buildOwnedScriptSet(
  utxos: Utxo[],
  addresses: string[],
  network: bitcoinjs.Network
): Set<string> {
  const owned = new Set<string>()
  for (const utxo of utxos) {
    const scriptHex = utxoScriptHex(utxo)
    if (scriptHex) {
      owned.add(scriptHex)
    }
    if (utxo.addressTo) {
      const fromAddress = addressScriptHex(utxo.addressTo, network)
      if (fromAddress) {
        owned.add(fromAddress)
      }
    }
  }
  for (const address of addresses) {
    const scriptHex = addressScriptHex(address, network)
    if (scriptHex) {
      owned.add(scriptHex)
    }
  }
  return owned
}

function buildPayjoinWalletCallbacks(params: {
  utxos: Utxo[]
  transactions?: Transaction[]
  outputs?: Output[]
  network: bitcoinjs.Network
  ownedAddresses?: string[]
  hasSeenInput: (outpoint: string) => boolean
  markInputSeen: (outpoint: string) => void
  signPsbt: (psbtBase64: string) => string | Promise<string>
}): PayjoinWalletCallbacks & {
  outputScriptsHex: string[]
  ownedScriptsHex: string[]
} {
  const contributeUtxos = params.transactions
    ? filterPayjoinContributeUtxos(params.utxos, params.transactions)
    : params.utxos
  const ownedScripts = buildOwnedScriptSet(
    params.utxos,
    params.ownedAddresses ?? [],
    params.network
  )

  const outputScriptsHex = (params.outputs ?? [])
    .map((output) => addressScriptHex(output.to, params.network))
    .filter((script): script is string => !!script)

  return {
    hasSeenInput: params.hasSeenInput,
    isScriptOwned: (scriptHex) => ownedScripts.has(scriptHex),
    listCandidateOutpoints: () =>
      contributeUtxos
        .map((utxo) => {
          const fromScript = utxoScriptHex(utxo)
          const fromAddress = utxo.addressTo
            ? addressScriptHex(utxo.addressTo, params.network)
            : undefined
          return {
            scriptHex: fromScript || fromAddress || '',
            txid: utxo.txid,
            value: utxo.value,
            vout: utxo.vout
          }
        })
        .filter((candidate) => !!candidate.scriptHex),
    markInputSeen: params.markInputSeen,
    outputScriptsHex,
    ownedScriptsHex: [...ownedScripts],
    signPsbt: params.signPsbt
  }
}

export {
  addressScriptHex,
  buildOwnedScriptSet,
  buildPayjoinWalletCallbacks,
  utxoScriptHex
}
