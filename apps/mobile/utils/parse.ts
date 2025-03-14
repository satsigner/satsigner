import type { Account } from '@/types/models/Account'

import { getUtxoOutpoint } from './utxo'

function parseAccountAddressesDetails({
  addresses,
  transactions,
  utxos,
  keys: {
    0: { scriptVersion }
  }
}: Account): Account['addresses'] {
  const labelsBackup: Record<string, string> = {}

  addresses.forEach((addr) => {
    labelsBackup[addr.address] = addr.label
  })

  const addressesWithDetails = [...addresses]

  const addrDictionary: Record<string, number> = {}

  for (let i = 0; i < addressesWithDetails.length; i += 1) {
    addrDictionary[addressesWithDetails[i].address] = i
    addressesWithDetails[i].summary.utxos = 0
    addressesWithDetails[i].summary.balance = 0
    addressesWithDetails[i].summary.satsInMempool = 0
    addressesWithDetails[i].summary.transactions = 0
    addressesWithDetails[i].scriptVersion = scriptVersion
  }

  for (const tx of transactions) {
    for (const output of tx.vout) {
      if (addrDictionary[output.address] === undefined) continue
      const index = addrDictionary[output.address]
      addressesWithDetails[index].summary.transactions += 1
      addressesWithDetails[index].transactions.push(tx.id)
    }
  }

  for (const utxo of utxos) {
    if (!utxo.addressTo || addrDictionary[utxo.addressTo] === undefined)
      continue
    const index = addrDictionary[utxo.addressTo]
    addressesWithDetails[index].summary.utxos += 1
    addressesWithDetails[index].summary.balance += utxo.value
    addressesWithDetails[index].utxos.push(getUtxoOutpoint(utxo))
  }

  return addressesWithDetails
}

function parseAddressDescriptorToAddress(descriptor: string) {
  const match = descriptor.match(/^addr\(([a-z0-9]+)\)$/i)
  if (!match) throw new Error('invalid address descriptor')
  return match[1]
}

function parseHexToBytes(hex: string): number[] {
  const bytes = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16))
  }
  return bytes
}

function parseLabel(rawLabel: string) {
  const matches = rawLabel.match(/#\w[\w\d]+/g)
  if (!matches) return { label: rawLabel, tags: [] }

  const tags = matches.map((match) => match.replace('#', ''))
  const label = rawLabel.replace(/#.*/, '').trim()
  return { label, tags }
}

function parseLabelTags(label: string, tags: string[]) {
  const trimmedLabel = label.trim()
  if (tags.length === 0) return trimmedLabel
  const labelTagSeparator = label.length === 0 ? '' : ' '
  return trimmedLabel + labelTagSeparator + tags.map((t) => '#' + t).join(' ')
}

export {
  parseAccountAddressesDetails,
  parseAddressDescriptorToAddress,
  parseHexToBytes,
  parseLabel,
  parseLabelTags
}
