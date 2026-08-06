import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { getAccountAddressSets } from '@/utils/address'
import { getUtxoOutpoint } from '@/utils/utxo'

type OwnedOutpointSource = {
  addresses?: Account['addresses']
  transactions?: Pick<Transaction, 'id' | 'vout'>[]
  utxos?: Pick<Utxo, 'txid' | 'vout'>[]
}

type ChartVin = {
  previousOutput?: { txid?: string; vout?: number }
  value?: number
}

/**
 * Outpoints this wallet created (or still holds). Used to mark Sankey inputs
 * as ours vs counterparty — the main on-chain Payjoin tell.
 */
function buildOwnedOutpoints(source: OwnedOutpointSource): Set<string> {
  const owned = new Set<string>()
  const { ownAddresses, internalAddresses } = getAccountAddressSets(
    source.addresses ?? []
  )

  for (const utxo of source.utxos ?? []) {
    owned.add(getUtxoOutpoint(utxo))
  }

  for (const tx of source.transactions ?? []) {
    if (!tx.id) {
      continue
    }
    for (let index = 0; index < (tx.vout?.length ?? 0); index += 1) {
      const output = tx.vout?.[index]
      if (!output) {
        continue
      }
      const address = output.address?.trim()
      if (
        output.kind === 'change' ||
        (address &&
          (ownAddresses.has(address) || internalAddresses.has(address)))
      ) {
        owned.add(`${tx.id}:${index}`)
      }
    }
  }

  return owned
}

function isOwnedOutpoint(
  ownedOutpoints: ReadonlySet<string> | undefined,
  txid: string | undefined,
  vout: number | undefined
): boolean | undefined {
  if (!ownedOutpoints || ownedOutpoints.size === 0) {
    return undefined
  }
  if (!txid || typeof vout !== 'number') {
    return undefined
  }
  return ownedOutpoints.has(`${txid}:${vout}`)
}

type PossiblePayjoinInsight = {
  contributedSats: number
  counterpartyInputSats: number
  hasForeignInput: boolean
  hasOwnInput: boolean
  /** Soft heuristic — mixed ownership with ≥2 inputs. */
  possiblePayjoin: boolean
}

function analyzePossiblePayjoin(
  vin: ChartVin[] | undefined,
  ownedOutpoints: ReadonlySet<string> | undefined
): PossiblePayjoinInsight {
  let hasOwnInput = false
  let hasForeignInput = false
  let contributedSats = 0
  let counterpartyInputSats = 0
  let classified = 0

  for (const input of vin ?? []) {
    const owned = isOwnedOutpoint(
      ownedOutpoints,
      input.previousOutput?.txid,
      input.previousOutput?.vout
    )
    if (owned === undefined) {
      continue
    }
    classified += 1
    const value = input.value ?? 0
    if (owned) {
      hasOwnInput = true
      contributedSats += value
    } else {
      hasForeignInput = true
      counterpartyInputSats += value
    }
  }

  const possiblePayjoin =
    classified >= 2 && hasOwnInput && hasForeignInput && (vin?.length ?? 0) >= 2

  return {
    contributedSats,
    counterpartyInputSats,
    hasForeignInput,
    hasOwnInput,
    possiblePayjoin
  }
}

export {
  analyzePossiblePayjoin,
  buildOwnedOutpoints,
  isOwnedOutpoint,
  type PossiblePayjoinInsight
}
