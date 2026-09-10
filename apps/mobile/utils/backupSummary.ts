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
  return Object.values(value).reduce(
    (total, nested) => total + countArray(nested),
    0
  )
}

function countNestedRecords(value: unknown): number {
  if (!isRecord(value)) {
    return 0
  }
  return Object.values(value).reduce(
    (total, nested) => total + countKeys(nested),
    0
  )
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
  return accounts.reduce((total, account) => {
    if (!isRecord(account)) {
      return total
    }
    return total + countKeys(account.labels)
  }, 0)
}

function countBitcoinSecrets(accounts: unknown): number {
  if (!Array.isArray(accounts)) {
    return 0
  }
  return accounts.reduce((total, account) => {
    if (!isRecord(account) || !Array.isArray(account.keys)) {
      return total
    }
    return (
      total +
      account.keys.filter(
        (key) => isRecord(key) && isNonEmptyString(key.seedWords)
      ).length
    )
  }, 0)
}

function countNostrSecrets(identities: unknown): number {
  if (!Array.isArray(identities)) {
    return 0
  }
  return identities.filter(
    (identity) =>
      isRecord(identity) &&
      (isNonEmptyString(identity.nsec) || isNonEmptyString(identity.mnemonic))
  ).length
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
    const parsed: unknown = JSON.parse(payload)
    if (!isRecord(parsed)) {
      return emptySummary(bytes, true)
    }
    const identities = isRecord(parsed.nostrIdentities)
      ? parsed.nostrIdentities.identities
      : undefined
    const ark = isRecord(parsed.ark) ? parsed.ark : undefined
    const ecash = isRecord(parsed.ecash) ? parsed.ecash : undefined
    const lightning = isRecord(parsed.lightning) ? parsed.lightning : undefined
    const nostrIdentities = isRecord(parsed.nostrIdentities)
      ? parsed.nostrIdentities
      : undefined
    return {
      ark: {
        accounts: countArray(ark?.accounts),
        datadirs: countKeys(ark?.datadirs),
        labels: countNestedRecords(ark?.labels),
        secrets: countNonEmptyStringsInRecord(ark?.mnemonics)
      },
      bitcoin: {
        accounts: countArray(parsed.accounts),
        labels: countBitcoinLabels(parsed.accounts),
        secrets: countBitcoinSecrets(parsed.accounts)
      },
      bytes,
      ecash: {
        accounts: countArray(ecash?.accounts),
        mints: countNestedArrays(ecash?.mints),
        proofs: countNestedArrays(ecash?.proofs),
        secrets: countNonEmptyStringsInRecord(ecash?.mnemonics),
        transactions: countNestedArrays(ecash?.transactions)
      },
      lightning: {
        channels: countArray(lightning?.channels),
        hasConfig:
          lightning?.config !== null &&
          lightning?.config !== undefined &&
          typeof lightning.config === 'object'
      },
      nostr: {
        accounts: countArray(identities),
        relays: countArray(nostrIdentities?.relays),
        secrets: countNostrSecrets(identities)
      },
      parseable: true
    }
  } catch {
    return emptySummary(bytes, false)
  }
}
