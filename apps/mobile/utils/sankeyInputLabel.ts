type LabelMap = Map<string, string> | Record<string, string>

function getLabelFromMap(
  map: LabelMap | undefined,
  key: string
): string | undefined {
  if (!map) {
    return undefined
  }
  const value = map instanceof Map ? map.get(key) : map[key]
  return value?.trim() || undefined
}

function isSyntheticIoLabel(
  label: string,
  txLabel: string | undefined,
  kind: 'input' | 'output',
  index: number
): boolean {
  if (!txLabel?.trim()) {
    return false
  }
  return label === `${txLabel.trim()} (${kind} ${index})`
}

/**
 * Prefer the previous transaction label; fall back to the consumed outpoint
 * label (`txid:vout`). Never use vin.label — that is often the current
 * (outgoing) tx label fabricated as "{tx} (input N)".
 */
function resolveSankeyInputLabel(
  prevTxId: string,
  vout: number,
  txLabelsById?: LabelMap,
  outpointLabelsByRef?: LabelMap
): string {
  const txLabel = getLabelFromMap(txLabelsById, prevTxId)
  if (txLabel) {
    return txLabel
  }
  return getLabelFromMap(outpointLabelsByRef, `${prevTxId}:${vout}`) ?? ''
}

function buildTxLabelsById(
  transactions: { id: string; label?: string }[] | undefined
): Map<string, string> {
  const labels = new Map<string, string>()
  for (const tx of transactions ?? []) {
    const label = tx.label?.trim()
    if (label) {
      labels.set(tx.id, label)
    }
  }
  return labels
}

function buildKnownTxIds(
  transactions: { id: string }[] | undefined
): Set<string> {
  const ids = new Set<string>()
  for (const tx of transactions ?? []) {
    if (tx.id) {
      ids.add(tx.id)
    }
  }
  return ids
}

/**
 * Map each spent outpoint (`txid:vout`) to the wallet transaction that
 * consumed it. Used to open spending-tx details from spent Sankey outputs.
 */
function buildSpendingTxIdsByOutpoint(
  transactions:
    | {
        id: string
        vin?: { previousOutput?: { txid?: string; vout?: number } }[]
      }[]
    | undefined
): Map<string, string> {
  const spendingTxIds = new Map<string, string>()
  for (const tx of transactions ?? []) {
    if (!tx.id) {
      continue
    }
    for (const vin of tx.vin ?? []) {
      const prevTxId = vin.previousOutput?.txid
      const vout = vin.previousOutput?.vout
      if (!prevTxId || typeof vout !== 'number') {
        continue
      }
      const outpoint = `${prevTxId}:${vout}`
      if (!spendingTxIds.has(outpoint)) {
        spendingTxIds.set(outpoint, tx.id)
      }
    }
  }
  return spendingTxIds
}

/** Real outpoint labels for consumed UTXOs — not fabricated vin/vout inherit labels. */
function buildOutpointLabelsByRef(account: {
  labels?: Record<string, { label?: string }>
  transactions?: {
    id: string
    label?: string
    vout?: { label?: string }[]
  }[]
  utxos?: { txid: string; vout: number; label?: string }[]
}): Map<string, string> {
  const labels = new Map<string, string>()

  for (const [ref, entry] of Object.entries(account.labels ?? {})) {
    if (!ref.includes(':')) {
      continue
    }
    const label = entry.label?.trim()
    if (label) {
      labels.set(ref, label)
    }
  }

  for (const utxo of account.utxos ?? []) {
    const label = utxo.label?.trim()
    if (!label) {
      continue
    }
    labels.set(`${utxo.txid}:${utxo.vout}`, label)
  }

  for (const tx of account.transactions ?? []) {
    const outputs = tx.vout ?? []
    for (let index = 0; index < outputs.length; index += 1) {
      const output = outputs[index]
      const label = output.label?.trim()
      if (!label) {
        continue
      }
      if (isSyntheticIoLabel(label, tx.label, 'output', index)) {
        continue
      }
      const ref = `${tx.id}:${index}`
      if (!labels.has(ref)) {
        labels.set(ref, label)
      }
    }
  }

  return labels
}

export {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildSpendingTxIdsByOutpoint,
  buildTxLabelsById,
  resolveSankeyInputLabel
}
