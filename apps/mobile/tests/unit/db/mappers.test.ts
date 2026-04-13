import {
  boolToInt,
  dateToIso,
  optionalToJson,
  parseJson,
  rowToAccount,
  rowToAddress,
  rowToLabel,
  rowToNostrDm,
  rowToTransaction,
  rowToUtxo,
  type AccountRow,
  type AddressRow,
  type LabelRow,
  type NostrDmRow,
  type TransactionRow,
  type TxInputRow,
  type TxOutputRow,
  type UtxoRow
} from '@/db/mappers'

function makeAccountRow(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    balance: 100000,
    created_at: '2024-01-01T00:00:00.000Z',
    id: 'acc-1',
    key_count: 1,
    keys: JSON.stringify([
      {
        creationType: 'generateMnemonic',
        fingerprint: 'abcdef12',
        index: 0
      }
    ]),
    keys_required: 1,
    last_synced_at: '2024-06-15T12:00:00.000Z',
    name: 'Test Account',
    network: 'bitcoin',
    nostr_auto_sync: 0,
    nostr_common_npub: 'npub1abc',
    nostr_common_nsec: 'nsec1abc',
    nostr_device_display_name: null,
    nostr_device_npub: null,
    nostr_device_nsec: null,
    nostr_device_picture: null,
    nostr_last_backup_fingerprint: null,
    nostr_last_updated: '2024-06-15T12:00:00.000Z',
    nostr_npub_aliases: '{}',
    nostr_npub_profiles: '{}',
    nostr_sync_start: '2024-01-01T00:00:00.000Z',
    num_addresses: 2,
    num_transactions: 3,
    num_utxos: 4,
    policy_type: 'singlesig',
    sats_in_mempool: 0,
    sync_progress_done: null,
    sync_progress_total: null,
    sync_status: 'synced',
    ...overrides
  }
}

function makeTransactionRow(
  overrides: Partial<TransactionRow> = {}
): TransactionRow {
  return {
    account_id: 'acc-1',
    address: 'bc1qaddr',
    block_height: 840000,
    fee: 250,
    id: 'tx-1',
    label: 'payment',
    lock_time: 0,
    lock_time_enabled: 0,
    prices: JSON.stringify({ usd: 60000 }),
    raw: JSON.stringify([1, 0, 0, 0]),
    received: 50000,
    sent: 0,
    size: 225,
    timestamp: '2024-06-01T10:00:00.000Z',
    type: 'receive',
    version: 2,
    vsize: 141,
    weight: 561,
    ...overrides
  }
}

function makeTxInputRow(overrides: Partial<TxInputRow> = {}): TxInputRow {
  return {
    input_index: 0,
    label: null,
    prev_txid: 'prev-tx-1',
    prev_vout: 0,
    script_sig: null,
    sequence: 4294967295,
    value: 50000,
    witness: JSON.stringify([
      [1, 2],
      [3, 4]
    ]),
    ...overrides
  }
}

function makeTxOutputRow(overrides: Partial<TxOutputRow> = {}): TxOutputRow {
  return {
    address: 'bc1qout',
    label: 'change',
    output_index: 0,
    script: JSON.stringify([0, 20, 1, 2, 3]),
    value: 49750,
    ...overrides
  }
}

function makeUtxoRow(overrides: Partial<UtxoRow> = {}): UtxoRow {
  return {
    account_id: 'acc-1',
    address_to: 'bc1qaddr',
    keychain: 'external',
    label: 'savings',
    script: JSON.stringify([0, 20, 1, 2]),
    timestamp: '2024-06-01T10:00:00.000Z',
    txid: 'utxo-tx-1',
    value: 50000,
    vout: 0,
    ...overrides
  }
}

function makeAddressRow(overrides: Partial<AddressRow> = {}): AddressRow {
  return {
    account_id: 'acc-1',
    addr_index: 0,
    address: 'bc1qaddr',
    balance: 50000,
    derivation_path: "m/84'/0'/0'/0/0",
    keychain: 'external',
    label: 'main',
    network: 'bitcoin',
    sats_in_mempool: 0,
    script_version: 'P2WPKH',
    tx_count: 2,
    utxo_count: 1,
    ...overrides
  }
}

function makeLabelRow(overrides: Partial<LabelRow> = {}): LabelRow {
  return {
    account_id: 'acc-1',
    fee: 250,
    fmv: JSON.stringify({ usd: 60000 }),
    height: 840000,
    heights: JSON.stringify([839999, 840000]),
    keypath: "m/84'/0'/0'/0/0",
    label: 'donation',
    origin: 'user',
    rate: JSON.stringify({ usd: 60000 }),
    ref: 'tx-1',
    spendable: 1,
    time: '2024-06-01T10:00:00.000Z',
    type: 'tx',
    value: 50000,
    ...overrides
  }
}

function makeNostrDmRow(overrides: Partial<NostrDmRow> = {}): NostrDmRow {
  return {
    account_id: 'acc-1',
    author: 'npub1sender',
    content_created_at: 1700000001,
    content_description: 'encrypted content',
    content_pubkey: 'npub1content',
    created_at: 1700000000,
    description: 'backup request',
    event: '{"kind":4}',
    id: 'dm-1',
    label: 1,
    pending: 0,
    read: 1,
    ...overrides
  }
}

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":1}', {})).toStrictEqual({ a: 1 })
  })

  it('returns fallback for null', () => {
    expect(parseJson(null, [])).toStrictEqual([])
  })

  it('returns fallback for empty string', () => {
    expect(parseJson('', 'default')).toBe('default')
  })

  it('returns fallback for invalid JSON', () => {
    expect(parseJson('{broken', 42)).toBe(42)
  })

  it('parses arrays', () => {
    expect(parseJson('[1,2,3]', [])).toStrictEqual([1, 2, 3])
  })

  it('parses nested objects', () => {
    expect(parseJson('{"a":{"b":true}}', {})).toStrictEqual({ a: { b: true } })
  })
})

describe('dateToIso', () => {
  it('converts Date to ISO string', () => {
    const date = new Date('2024-01-15T08:30:00.000Z')
    expect(dateToIso(date)).toBe('2024-01-15T08:30:00.000Z')
  })

  it('returns null for undefined', () => {
    expect(dateToIso(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(dateToIso(null)).toBeNull()
  })
})

describe('boolToInt', () => {
  it('converts true to 1', () => {
    expect(boolToInt(true)).toBe(1)
  })

  it('converts false to 0', () => {
    expect(boolToInt(false)).toBe(0)
  })

  it('converts undefined to 0', () => {
    expect(boolToInt(undefined)).toBe(0)
  })
})

describe('optionalToJson', () => {
  it('serializes object', () => {
    expect(optionalToJson({ a: 1 })).toBe('{"a":1}')
  })

  it('serializes array', () => {
    expect(optionalToJson([1, 2])).toBe('[1,2]')
  })

  it('returns null for undefined', () => {
    expect(optionalToJson(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(optionalToJson(null)).toBeNull()
  })

  it('serializes string value', () => {
    expect(optionalToJson('hello')).toBe('"hello"')
  })

  it('serializes number', () => {
    expect(optionalToJson(42)).toBe('42')
  })

  it('serializes boolean', () => {
    expect(optionalToJson(true)).toBe('true')
  })
})

describe('rowToAccount', () => {
  it('maps full account row', () => {
    const row = makeAccountRow()
    const result = rowToAccount(row, [], [], [], {}, [], [], [])

    expect(result.id).toBe('acc-1')
    expect(result.name).toBe('Test Account')
    expect(result.network).toBe('bitcoin')
    expect(result.policyType).toBe('singlesig')
    expect(result.keyCount).toBe(1)
    expect(result.keysRequired).toBe(1)
    expect(result.syncStatus).toBe('synced')
    expect(result.createdAt).toStrictEqual(new Date('2024-01-01T00:00:00.000Z'))
    expect(result.lastSyncedAt).toStrictEqual(
      new Date('2024-06-15T12:00:00.000Z')
    )
  })

  it('maps keys as KeyMeta with empty secret/iv', () => {
    const row = makeAccountRow()
    const result = rowToAccount(row, [], [], [], {}, [], [], [])
    const [key] = result.keys

    expect(key.index).toBe(0)
    expect(key.creationType).toBe('generateMnemonic')
    expect(key.fingerprint).toBe('abcdef12')
    expect(key.secret).toBe('')
    expect(key.iv).toBe('')
  })

  it('handles empty keys JSON', () => {
    const row = makeAccountRow({ keys: '[]' })
    const result = rowToAccount(row, [], [], [], {}, [], [], [])
    expect(result.keys).toStrictEqual([])
  })

  it('handles invalid keys JSON gracefully', () => {
    const row = makeAccountRow({ keys: '{broken' })
    const result = rowToAccount(row, [], [], [], {}, [], [], [])
    expect(result.keys).toStrictEqual([])
  })

  it('maps summary fields', () => {
    const row = makeAccountRow({
      balance: 200000,
      num_addresses: 5,
      num_transactions: 10,
      num_utxos: 3,
      sats_in_mempool: 1000
    })
    const result = rowToAccount(row, [], [], [], {}, [], [], [])

    expect(result.summary).toStrictEqual({
      balance: 200000,
      numberOfAddresses: 5,
      numberOfTransactions: 10,
      numberOfUtxos: 3,
      satsInMempool: 1000
    })
  })

  it('maps sync progress when present', () => {
    const row = makeAccountRow({
      sync_progress_done: 75,
      sync_progress_total: 100
    })
    const result = rowToAccount(row, [], [], [], {}, [], [], [])

    expect(result.syncProgress).toStrictEqual({
      tasksDone: 75,
      totalTasks: 100
    })
  })

  it('sets syncProgress undefined when total is null', () => {
    const row = makeAccountRow({
      sync_progress_done: null,
      sync_progress_total: null
    })
    const result = rowToAccount(row, [], [], [], {}, [], [], [])
    expect(result.syncProgress).toBeUndefined()
  })

  it('defaults lastSyncedAt to undefined when null', () => {
    const row = makeAccountRow({ last_synced_at: null })
    const result = rowToAccount(row, [], [], [], {}, [], [], [])
    expect(result.lastSyncedAt).toBeUndefined()
  })

  it('passes through child data', () => {
    const txs = [{ id: 'tx-1' }] as never[]
    const utxos = [{ txid: 'u-1' }] as never[]
    const addrs = [{ address: 'bc1q' }] as never[]
    const labels = { ref1: { label: 'test' } } as never
    const dms = [{ id: 'dm-1' }] as never[]
    const relays = ['wss://relay.example.com']
    const devices = ['device-1']

    const row = makeAccountRow()
    const result = rowToAccount(
      row,
      txs,
      utxos,
      addrs,
      labels,
      dms,
      relays,
      devices
    )

    expect(result.transactions).toBe(txs)
    expect(result.utxos).toBe(utxos)
    expect(result.addresses).toBe(addrs)
    expect(result.labels).toBe(labels)
    expect(result.nostr.dms).toBe(dms)
    expect(result.nostr.relays).toBe(relays)
    expect(result.nostr.trustedMemberDevices).toBe(devices)
  })

  it('maps nostr fields', () => {
    const row = makeAccountRow({
      nostr_auto_sync: 1,
      nostr_device_display_name: 'My Phone',
      nostr_device_npub: 'npub1dev',
      nostr_device_nsec: 'nsec1dev',
      nostr_device_picture: 'https://pic.example.com',
      nostr_last_backup_fingerprint: 'fp123',
      nostr_npub_aliases: '{"npub1":"Alice"}',
      nostr_npub_profiles: '{"npub1":{"displayName":"Alice"}}'
    })
    const result = rowToAccount(row, [], [], [], {}, [], [], [])

    expect(result.nostr.autoSync).toBe(true)
    expect(result.nostr.deviceNpub).toBe('npub1dev')
    expect(result.nostr.deviceNsec).toBe('nsec1dev')
    expect(result.nostr.deviceDisplayName).toBe('My Phone')
    expect(result.nostr.devicePicture).toBe('https://pic.example.com')
    expect(result.nostr.lastBackupFingerprint).toBe('fp123')
    expect(result.nostr.npubAliases).toStrictEqual({ npub1: 'Alice' })
    expect(result.nostr.npubProfiles).toStrictEqual({
      npub1: { displayName: 'Alice' }
    })
  })
})

describe('rowToTransaction', () => {
  it('maps scalar transaction fields', () => {
    const row = makeTransactionRow()
    const result = rowToTransaction(row, [], [])

    expect(result.id).toBe('tx-1')
    expect(result.type).toBe('receive')
    expect(result.sent).toBe(0)
    expect(result.received).toBe(50000)
    expect(result.blockHeight).toBe(840000)
    expect(result.fee).toBe(250)
    expect(result.label).toBe('payment')
    expect(result.timestamp).toStrictEqual(new Date('2024-06-01T10:00:00.000Z'))
  })

  it('maps parsed JSON fields', () => {
    const row = makeTransactionRow()
    const result = rowToTransaction(row, [], [])

    expect(result.lockTimeEnabled).toBe(false)
    expect(result.prices).toStrictEqual({ usd: 60000 })
    expect(result.raw).toStrictEqual([1, 0, 0, 0])
  })

  it('maps vin correctly', () => {
    const input = makeTxInputRow({
      label: 'input-label',
      script_sig: JSON.stringify([1, 2, 3]),
      witness: JSON.stringify([[10, 20], [30]])
    })
    const result = rowToTransaction(makeTransactionRow(), [input], [])

    expect(result.vin).toHaveLength(1)
    expect(result.vin[0].previousOutput).toStrictEqual({
      txid: 'prev-tx-1',
      vout: 0
    })
    expect(result.vin[0].sequence).toBe(4294967295)
    expect(result.vin[0].witness).toStrictEqual([[10, 20], [30]])
    expect(result.vin[0].scriptSig).toStrictEqual([1, 2, 3])
    expect(result.vin[0].value).toBe(50000)
    expect(result.vin[0].label).toBe('input-label')
  })

  it('maps vout correctly', () => {
    const output = makeTxOutputRow()
    const result = rowToTransaction(makeTransactionRow(), [], [output])

    expect(result.vout).toHaveLength(1)
    expect(result.vout[0].value).toBe(49750)
    expect(result.vout[0].address).toBe('bc1qout')
    expect(result.vout[0].script).toStrictEqual([0, 20, 1, 2, 3])
    expect(result.vout[0].label).toBe('change')
  })

  it('handles null optional fields', () => {
    const row = makeTransactionRow({
      address: null,
      block_height: null,
      fee: null,
      label: null,
      lock_time: null,
      raw: null,
      size: null,
      timestamp: null,
      version: null,
      vsize: null,
      weight: null
    })
    const result = rowToTransaction(row, [], [])

    expect(result.timestamp).toBeUndefined()
    expect(result.blockHeight).toBeUndefined()
    expect(result.address).toBeUndefined()
    expect(result.label).toBe('')
    expect(result.fee).toBeUndefined()
    expect(result.size).toBeUndefined()
    expect(result.raw).toBeUndefined()
  })

  it('handles null witness and scriptSig', () => {
    const input = makeTxInputRow({ script_sig: null, witness: null })
    const result = rowToTransaction(makeTransactionRow(), [input], [])

    expect(result.vin[0].witness).toStrictEqual([])
    expect(result.vin[0].scriptSig).toBe('')
  })

  it('handles lock_time_enabled as boolean', () => {
    const enabled = makeTransactionRow({ lock_time_enabled: 1 })
    const disabled = makeTransactionRow({ lock_time_enabled: 0 })

    expect(rowToTransaction(enabled, [], []).lockTimeEnabled).toBe(true)
    expect(rowToTransaction(disabled, [], []).lockTimeEnabled).toBe(false)
  })
})

describe('rowToUtxo', () => {
  it('maps full utxo row', () => {
    const row = makeUtxoRow()
    const result = rowToUtxo(row)

    expect(result.txid).toBe('utxo-tx-1')
    expect(result.vout).toBe(0)
    expect(result.value).toBe(50000)
    expect(result.label).toBe('savings')
    expect(result.addressTo).toBe('bc1qaddr')
    expect(result.keychain).toBe('external')
    expect(result.timestamp).toStrictEqual(new Date('2024-06-01T10:00:00.000Z'))
    expect(result.script).toStrictEqual([0, 20, 1, 2])
  })

  it('handles null optional fields', () => {
    const row = makeUtxoRow({
      address_to: null,
      label: null,
      script: null,
      timestamp: null
    })
    const result = rowToUtxo(row)

    expect(result.timestamp).toBeUndefined()
    expect(result.label).toBe('')
    expect(result.addressTo).toBeUndefined()
    expect(result.script).toBeUndefined()
  })

  it('handles internal keychain', () => {
    const row = makeUtxoRow({ keychain: 'internal' })
    expect(rowToUtxo(row).keychain).toBe('internal')
  })
})

describe('rowToAddress', () => {
  it('maps full address row', () => {
    const row = makeAddressRow()
    const result = rowToAddress(row, ['tx-1', 'tx-2'], ['utxo-1:0'])

    expect(result.address).toBe('bc1qaddr')
    expect(result.label).toBe('main')
    expect(result.derivationPath).toBe("m/84'/0'/0'/0/0")
    expect(result.index).toBe(0)
    expect(result.keychain).toBe('external')
    expect(result.network).toBe('bitcoin')
    expect(result.scriptVersion).toBe('P2WPKH')
    expect(result.transactions).toStrictEqual(['tx-1', 'tx-2'])
    expect(result.utxos).toStrictEqual(['utxo-1:0'])
  })

  it('maps summary fields', () => {
    const row = makeAddressRow({
      balance: 75000,
      sats_in_mempool: 500,
      tx_count: 5,
      utxo_count: 3
    })
    const result = rowToAddress(row, [], [])

    expect(result.summary).toStrictEqual({
      balance: 75000,
      satsInMempool: 500,
      transactions: 5,
      utxos: 3
    })
  })

  it('handles null optional fields', () => {
    const row = makeAddressRow({
      addr_index: null,
      derivation_path: null,
      keychain: null,
      label: null,
      network: null,
      script_version: null
    })
    const result = rowToAddress(row, [], [])

    expect(result.label).toBe('')
    expect(result.derivationPath).toBeUndefined()
    expect(result.index).toBeUndefined()
    expect(result.keychain).toBeUndefined()
    expect(result.network).toBeUndefined()
    expect(result.scriptVersion).toBeUndefined()
  })
})

describe('rowToLabel', () => {
  it('maps label identity and core fields', () => {
    const row = makeLabelRow()
    const result = rowToLabel(row)

    expect(result.ref).toBe('tx-1')
    expect(result.type).toBe('tx')
    expect(result.label).toBe('donation')
    expect(result.fee).toBe(250)
    expect(result.height).toBe(840000)
    expect(result.keypath).toBe("m/84'/0'/0'/0/0")
    expect(result.origin).toBe('user')
    expect(result.value).toBe(50000)
  })

  it('maps label JSON and derived fields', () => {
    const row = makeLabelRow()
    const result = rowToLabel(row)

    expect(result.fmv).toStrictEqual({ usd: 60000 })
    expect(result.heights).toStrictEqual([839999, 840000])
    expect(result.rate).toStrictEqual({ usd: 60000 })
    expect(result.spendable).toBe(true)
    expect(result.time).toStrictEqual(new Date('2024-06-01T10:00:00.000Z'))
  })

  it('handles null optional fields', () => {
    const row = makeLabelRow({
      fee: null,
      fmv: null,
      height: null,
      heights: null,
      keypath: null,
      origin: null,
      rate: null,
      spendable: null,
      time: null,
      value: null
    })
    const result = rowToLabel(row)

    expect(result.fee).toBeUndefined()
    expect(result.fmv).toBeUndefined()
    expect(result.height).toBeUndefined()
    expect(result.heights).toBeUndefined()
    expect(result.keypath).toBeUndefined()
    expect(result.origin).toBeUndefined()
    expect(result.rate).toBeUndefined()
    expect(result.spendable).toBeUndefined()
    expect(result.time).toBeUndefined()
    expect(result.value).toBeUndefined()
  })

  it('maps spendable 0 to false', () => {
    const row = makeLabelRow({ spendable: 0 })
    expect(rowToLabel(row).spendable).toBe(false)
  })

  it('maps spendable 1 to true', () => {
    const row = makeLabelRow({ spendable: 1 })
    expect(rowToLabel(row).spendable).toBe(true)
  })

  it('maps spendable null to undefined', () => {
    const row = makeLabelRow({ spendable: null })
    expect(rowToLabel(row).spendable).toBeUndefined()
  })

  it('handles invalid fmv JSON gracefully', () => {
    const row = makeLabelRow({ fmv: '{broken' })
    expect(rowToLabel(row).fmv).toBeUndefined()
  })
})

describe('rowToNostrDm', () => {
  it('maps full DM row', () => {
    const row = makeNostrDmRow()
    const result = rowToNostrDm(row)

    expect(result.id).toBe('dm-1')
    expect(result.author).toBe('npub1sender')
    expect(result.created_at).toBe(1700000000)
    expect(result.description).toBe('backup request')
    expect(result.event).toBe('{"kind":4}')
    expect(result.label).toBe(1)
    expect(result.content.description).toBe('encrypted content')
    expect(result.content.created_at).toBe(1700000001)
    expect(result.content.pubkey).toBe('npub1content')
  })

  it('maps pending=1 to true', () => {
    const row = makeNostrDmRow({ pending: 1 })
    expect(rowToNostrDm(row).pending).toBe(true)
  })

  it('maps pending=0 to undefined', () => {
    const row = makeNostrDmRow({ pending: 0 })
    expect(rowToNostrDm(row).pending).toBeUndefined()
  })

  it('maps read=1 to true', () => {
    const row = makeNostrDmRow({ read: 1 })
    expect(rowToNostrDm(row).read).toBe(true)
  })

  it('maps read=0 to false', () => {
    const row = makeNostrDmRow({ read: 0 })
    expect(rowToNostrDm(row).read).toBe(false)
  })

  it('maps read=null to undefined', () => {
    const row = makeNostrDmRow({ read: null })
    expect(rowToNostrDm(row).read).toBeUndefined()
  })

  it('handles null content fields', () => {
    const row = makeNostrDmRow({
      content_created_at: null,
      content_description: null,
      content_pubkey: null
    })
    const result = rowToNostrDm(row)

    expect(result.content.description).toBe('')
    expect(result.content.created_at).toBe(0)
    expect(result.content.pubkey).toBeUndefined()
  })
})
