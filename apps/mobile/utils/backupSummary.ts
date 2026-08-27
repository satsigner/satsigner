export type BackupPayloadSummary = {
  arkAccounts: number
  arkDatadirAccounts: number
  bitcoinAccounts: number
  bytes: number
  ecashAccounts: number
  parseable: boolean
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function countKeys(value: unknown): number {
  if (!value || typeof value !== 'object') {
    return 0
  }
  return Object.keys(value).length
}

export function summarizeBackupPayload(payload: string): BackupPayloadSummary {
  const bytes = new TextEncoder().encode(payload).length
  try {
    const data = JSON.parse(payload) as {
      accounts?: unknown
      ark?: { accounts?: unknown; datadirs?: unknown }
      ecash?: { accounts?: unknown }
    }
    return {
      arkAccounts: countArray(data.ark?.accounts),
      arkDatadirAccounts: countKeys(data.ark?.datadirs),
      bitcoinAccounts: countArray(data.accounts),
      bytes,
      ecashAccounts: countArray(data.ecash?.accounts),
      parseable: true
    }
  } catch {
    return {
      arkAccounts: 0,
      arkDatadirAccounts: 0,
      bitcoinAccounts: 0,
      bytes,
      ecashAccounts: 0,
      parseable: false
    }
  }
}
