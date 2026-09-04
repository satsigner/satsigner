export type BackupPayloadSummary = {
  ark: {
    accounts: number
    datadirs: number
    labels: number
    secrets: number
  }
  bitcoin: {
    accounts: number
    labels: number
    secrets: number
  }
  bytes: number
  ecash: {
    accounts: number
    mints: number
    proofs: number
    secrets: number
    transactions: number
  }
  lightning: {
    channels: number
    hasConfig: boolean
  }
  nostr: {
    accounts: number
    relays: number
    secrets: number
  }
  parseable: boolean
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function countKeys(value: unknown): number {
  return isRecord(value) ? Object.keys(value).length : 0
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function countNestedArrays(value: unknown): number {
  if (!isRecord(value)) {
    return 0
  }
  let total = 0
  for (const nested of Object.values(value)) {
    total += countArray(nested)
  }
  return total
}

function countNestedRecords(value: unknown): number {
  if (!isRecord(value)) {
    return 0
  }
  let total = 0
  for (const nested of Object.values(value)) {
    total += countKeys(nested)
  }
  return total
}

function countNonEmptyStringsInRecord(value: unknown): number {
  if (!isRecord(value)) {
    return 0
  }
  return Object.values(value).filter(isNonEmptyString).length
}

function countBitcoinLabels(accounts: unknown): number {
  if (!Array.isArray(accounts)) {
    return 0
  }
  let total = 0
  for (const account of accounts) {
    if (!isRecord(account)) {
      continue
    }
    total += countKeys(account.labels)
  }
  return total
}

function countBitcoinSecrets(accounts: unknown): number {
  if (!Array.isArray(accounts)) {
    return 0
  }
  let total = 0
  for (const account of accounts) {
    if (!isRecord(account) || !Array.isArray(account.keys)) {
      continue
    }
    for (const key of account.keys) {
      if (isRecord(key) && isNonEmptyString(key.seedWords)) {
        total += 1
      }
    }
  }
  return total
}

function countNostrSecrets(identities: unknown): number {
  if (!Array.isArray(identities)) {
    return 0
  }
  let total = 0
  for (const identity of identities) {
    if (!isRecord(identity)) {
      continue
    }
    if (
      isNonEmptyString(identity.nsec) ||
      isNonEmptyString(identity.mnemonic)
    ) {
      total += 1
    }
  }
  return total
}

function emptySummary(bytes: number, parseable: boolean): BackupPayloadSummary {
  return {
    ark: { accounts: 0, datadirs: 0, labels: 0, secrets: 0 },
    bitcoin: { accounts: 0, labels: 0, secrets: 0 },
    bytes,
    ecash: {
      accounts: 0,
      mints: 0,
      proofs: 0,
      secrets: 0,
      transactions: 0
    },
    lightning: { channels: 0, hasConfig: false },
    nostr: { accounts: 0, relays: 0, secrets: 0 },
    parseable
  }
}

export function summarizeBackupPayload(payload: string): BackupPayloadSummary {
  const bytes = new TextEncoder().encode(payload).length
  try {
    const data = JSON.parse(payload) as {
      accounts?: unknown
      ark?: {
        accounts?: unknown
        datadirs?: unknown
        labels?: unknown
        mnemonics?: unknown
      }
      ecash?: {
        accounts?: unknown
        mints?: unknown
        mnemonics?: unknown
        proofs?: unknown
        transactions?: unknown
      }
      lightning?: { channels?: unknown; config?: unknown }
      nostrIdentities?: { identities?: unknown; relays?: unknown }
    }
    const identities = data.nostrIdentities?.identities
    return {
      ark: {
        accounts: countArray(data.ark?.accounts),
        datadirs: countKeys(data.ark?.datadirs),
        labels: countNestedRecords(data.ark?.labels),
        secrets: countNonEmptyStringsInRecord(data.ark?.mnemonics)
      },
      bitcoin: {
        accounts: countArray(data.accounts),
        labels: countBitcoinLabels(data.accounts),
        secrets: countBitcoinSecrets(data.accounts)
      },
      bytes,
      ecash: {
        accounts: countArray(data.ecash?.accounts),
        mints: countNestedArrays(data.ecash?.mints),
        proofs: countNestedArrays(data.ecash?.proofs),
        secrets: countNonEmptyStringsInRecord(data.ecash?.mnemonics),
        transactions: countNestedArrays(data.ecash?.transactions)
      },
      lightning: {
        channels: countArray(data.lightning?.channels),
        hasConfig:
          data.lightning?.config !== null &&
          data.lightning?.config !== undefined &&
          typeof data.lightning.config === 'object'
      },
      nostr: {
        accounts: countArray(identities),
        relays: countArray(data.nostrIdentities?.relays),
        secrets: countNostrSecrets(identities)
      },
      parseable: true
    }
  } catch {
    return emptySummary(bytes, false)
  }
}
