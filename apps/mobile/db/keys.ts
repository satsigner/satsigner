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

const arkLabelKeys = {
  all: (accountId: string | null | undefined) =>
    ['ark', 'labels', accountId] as const
}

const tagKeys = {
  all: ['tags'] as const
}

const nostrKeys = {
  contacts: (npub: string, relaysKey: string) =>
    ['nostr', 'contacts', npub, relaysKey] as const,
  dms: (accountId: string) => ['nostr', 'dms', accountId] as const,
  identity: ['nostr', 'identity'] as const,
  identityFeed: (npub: string, relaysKey: string, kindFilterId: string) =>
    ['nostr', 'identity', 'feed', npub, relaysKey, kindFilterId] as const,
  identityFollows: (npub: string, relaysKey: string) =>
    ['nostr', 'identity', 'follows', npub, relaysKey] as const,
  identityNewNotes: (
    tab: string,
    npub: string,
    relaysKey: string,
    kindFilterId: string,
    since: number
  ) =>
    [
      'nostr',
      'identity',
      'new-notes',
      tab,
      npub,
      relaysKey,
      kindFilterId,
      since
    ] as const,
  identityNote: (eventId: string, relaysKey: string) =>
    ['nostr', 'identity', 'note', eventId, relaysKey] as const,
  identityNoteLookup: (eventId: string, relaysKey: string) =>
    ['nostr', 'identity', 'note-lookup', eventId, relaysKey] as const,
  identityNoteReactions: (eventId: string, relaysKey: string) =>
    ['nostr', 'identity', 'note-reactions', eventId, relaysKey] as const,
  identityNoteZaps: (eventId: string, relaysKey: string) =>
    ['nostr', 'identity', 'note-zaps', eventId, relaysKey] as const,
  identityNotes: (npub: string, relaysKey: string, kindFilterId: string) =>
    ['nostr', 'identity', 'notes', npub, relaysKey, kindFilterId] as const,
  identityPollResponses: (eventId: string, relaysKey: string) =>
    ['nostr', 'identity', 'poll-responses', eventId, relaysKey] as const,
  identityProfiles: (groupsKey: string) =>
    ['nostr', 'identity', 'profiles', groupsKey] as const,
  identityPubkeyProfiles: (pubkeysKey: string, relaysKey: string) =>
    ['nostr', 'identity', 'pubkey-profiles', pubkeysKey, relaysKey] as const,
  identityReachability: (npub: string, relaysKey: string) =>
    ['nostr', 'identity', 'reachability', npub, relaysKey] as const,
  identityZaps: (pubkeyHex: string, relaysKey: string) =>
    ['nostr', 'identity', 'zaps', pubkeyHex, relaysKey] as const,
  relays: (accountId: string) => ['nostr', 'relays', accountId] as const,
  trustedDevices: (accountId: string) =>
    ['nostr', 'devices', accountId] as const
}

export {
  accountKeys,
  addressKeys,
  arkLabelKeys,
  labelKeys,
  nostrKeys,
  tagKeys,
  transactionKeys,
  utxoKeys
}
