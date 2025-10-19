import { t } from '@/locales'
import type { Account } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'

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

  const addressesDetailed = addresses.map((addr) => {
    return {
      ...addr,
      transactions: [] as string[],
      utxos: [] as string[],
      summary: {
        utxos: 0,
        transactions: 0,
        balance: 0,
        satsInMempool: 0
      },
      scriptVersion
    }
  })

  const addrDictionary: Record<string, number> = {}

  const txDictionary: Record<string, number> = {}

  for (let i = 0; i < addressesDetailed.length; i += 1) {
    addrDictionary[addressesDetailed[i].address] = i
  }

  for (let i = 0; i < transactions.length; i += 1) {
    txDictionary[transactions[i].id] = i
  }

  for (const tx of transactions) {
    for (const output of tx.vout) {
      if (addrDictionary[output.address] === undefined) {
        continue
      }
      const index = addrDictionary[output.address]
      if (addressesDetailed[index].transactions.includes(tx.id)) {
        continue
      }
      addressesDetailed[index].summary.transactions += 1
      addressesDetailed[index].transactions.push(tx.id)
    }

    for (const input of tx.vin) {
      const prevTxId = input.previousOutput.txid

      if (txDictionary[prevTxId] === undefined) {
        continue
      }

      const prevTxIndex = txDictionary[prevTxId]
      const vout = input.previousOutput.vout
      const prevTx = transactions[prevTxIndex]

      if (prevTx.vout[vout] === undefined) {
        continue
      }

      const prevTxAddr = prevTx.vout[vout].address

      if (addrDictionary[prevTxAddr] === undefined) {
        continue
      }

      const index = addrDictionary[prevTxAddr]

      if (addressesDetailed[index].transactions.includes(tx.id)) {
        continue
      }

      addressesDetailed[index].summary.transactions += 1
      addressesDetailed[index].transactions.push(tx.id)
    }
  }

  for (const utxo of utxos) {
    if (!utxo.addressTo || addrDictionary[utxo.addressTo] === undefined) {
      continue
    }
    const index = addrDictionary[utxo.addressTo]
    addressesDetailed[index].summary.utxos += 1
    addressesDetailed[index].summary.balance += utxo.value
    addressesDetailed[index].utxos.push(getUtxoOutpoint(utxo))
  }

  // Restore labels from backup
  addressesDetailed.forEach((addr) => {
    addr.label = labelsBackup[addr.address] || ''
  })

  return addressesDetailed
}

function parseAddressDescriptorToAddress(descriptor: string) {
  if (!descriptor || typeof descriptor !== 'string') {
    throw new Error(
      `Invalid address descriptor: expected string, got ${typeof descriptor}`
    )
  }

  const match = descriptor.match(/^addr\(([a-z0-9]+)\)$/i)
  if (!match) {
    throw new Error(
      `Invalid address descriptor format: "${descriptor}". Expected format: addr(address)`
    )
  }

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

function parseTXOutputs(input: string): Omit<Output, 'localId'>[] {
  const entries = input
    .split(',')
    .map((str) => str.trim())
    .filter(Boolean)

  return entries.map((entry) => {
    const [address, query] = entry.split('?')
    const params = new URLSearchParams(query)

    const amount = params.get('amount')
    const label = params.get('label')

    return {
      to: address,
      amount: amount ? Number(amount) : 0,
      label: label ? label.replace(/(^["“]|["”]$)/g, '') : t('common.noLabel')
    }
  })
}

function parseMultisigDescriptor(descriptor: string) {
  const keyPathMatches = descriptor.match(
    /\[([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\]/g
  )
  if (!keyPathMatches || keyPathMatches.length === 0) {
    throw new Error('Invalid multisig descriptor format')
  }

  const firstMatch = keyPathMatches[0].match(
    /\[([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\]/
  )
  if (!firstMatch) {
    throw new Error('Invalid multisig key path format')
  }

  const [, , purpose, coinType, accountIndex, keyType] = firstMatch
  const hardenedPath = `m/${purpose.replace("'", 'h')}/${coinType.replace(
    "'",
    'h'
  )}/${accountIndex.replace("'", 'h')}/${keyType.replace("'", 'h')}`

  const xpubRegex = /(tpub|vpub|upub|zpub)[a-zA-Z0-9]+/g
  const xpubs = (descriptor.match(xpubRegex) || []).sort()

  return { hardenedPath, xpubs }
}

function parseSinglesigDescriptor(descriptor: string) {
  const match = descriptor.match(/\[([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\]/)
  if (!match) {
    throw new Error('Invalid singlesig descriptor format')
  }

  const [, , purpose, coinType, accountIndex] = match
  const hardenedPath = `m/${purpose.replace("'", 'h')}/${coinType.replace(
    "'",
    'h'
  )}/${accountIndex.replace("'", 'h')}`

  const xpubRegex = /(tpub|vpub|upub|zpub)[a-zA-Z0-9]+/g
  const xpubs = (descriptor.match(xpubRegex) || []).sort()

  return { hardenedPath, xpubs }
}

export function parseDescriptor(descriptor: string) {
  if (descriptor.includes('wsh(sortedmulti')) {
    return parseMultisigDescriptor(descriptor)
  }
  return parseSinglesigDescriptor(descriptor)
}

export {
  parseAccountAddressesDetails,
  parseAddressDescriptorToAddress,
  parseHexToBytes,
  parseLabel,
  parseLabelTags,
  parseTXOutputs
}
