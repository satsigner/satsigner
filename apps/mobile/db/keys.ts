const accountKeys = {
  all: ['accounts'] as const,
  detail: (id: string) => ['accounts', id] as const
}

const transactionKeys = {
  all: (accountId: string) => ['transactions', accountId] as const,
  detail: (accountId: string, txid: string) =>
    ['transactions', accountId, txid] as const
}

const utxoKeys = {
  all: (accountId: string) => ['utxos', accountId] as const
}

const addressKeys = {
  all: (accountId: string) => ['addresses', accountId] as const,
  detail: (accountId: string, addr: string) =>
    ['addresses', accountId, addr] as const
}

const labelKeys = {
  all: (accountId: string) => ['labels', accountId] as const
}

const tagKeys = {
  all: ['tags'] as const
}

const nostrKeys = {
  dms: (accountId: string) => ['nostr', 'dms', accountId] as const,
  relays: (accountId: string) => ['nostr', 'relays', accountId] as const,
  trustedDevices: (accountId: string) =>
    ['nostr', 'devices', accountId] as const
}

export {
  accountKeys,
  addressKeys,
  labelKeys,
  nostrKeys,
  tagKeys,
  transactionKeys,
  utxoKeys
}
