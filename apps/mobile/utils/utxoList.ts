import { type Direction } from '@/types/logic/sort'
import { type ScriptVersionType } from '@/types/models/Script'
import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/outpoint'
import { parseLabel } from '@/utils/parse'
import { compareAmount, compareLabel, compareTimestamp } from '@/utils/sort'
import { getUtxoScriptType } from '@/utils/transaction'

type UtxoSortField = 'date' | 'amount' | 'label'

type UtxoGroupMode = 'none' | 'address' | 'label' | 'tag' | 'keychain'

type UtxoKeychainFilter = 'all' | 'external' | 'internal'

type UtxoLabelFilter = 'all' | 'labeled' | 'unlabeled'

type UtxoTagFilter = 'all' | 'tagged' | 'untagged'

/** Address-detectable script types (nested P2SH-* appear as P2SH). */
type UtxoScriptFilter = 'all' | ScriptVersionType

type UtxoListFilter = {
  keychain: UtxoKeychainFilter
  label: UtxoLabelFilter
  script: UtxoScriptFilter
  tag: UtxoTagFilter
}

type UtxoGroup = {
  key: string
  title: string
  utxos: Utxo[]
}

const DEFAULT_UTXO_LIST_FILTER: UtxoListFilter = {
  keychain: 'all',
  label: 'all',
  script: 'all',
  tag: 'all'
}

function isUtxoExcluded(
  utxo: Utxo,
  excludedOutpoints: Iterable<string>
): boolean {
  const excluded =
    excludedOutpoints instanceof Set
      ? excludedOutpoints
      : new Set(excludedOutpoints)
  return excluded.has(getUtxoOutpoint(utxo))
}

function applyUtxoDenylist(
  utxos: Utxo[],
  excludedOutpoints: Iterable<string>
): Utxo[] {
  const excluded =
    excludedOutpoints instanceof Set
      ? excludedOutpoints
      : new Set(excludedOutpoints)
  if (excluded.size === 0) {
    return utxos
  }
  return utxos.filter((utxo) => !excluded.has(getUtxoOutpoint(utxo)))
}

function pruneExcludedOutpoints(
  excludedOutpoints: string[],
  utxos: Utxo[]
): string[] {
  if (excludedOutpoints.length === 0) {
    return excludedOutpoints
  }
  const live = new Set(utxos.map(getUtxoOutpoint))
  return excludedOutpoints.filter((outpoint) => live.has(outpoint))
}

function filterUtxos(
  utxos: Utxo[],
  filter: UtxoListFilter = DEFAULT_UTXO_LIST_FILTER
): Utxo[] {
  return utxos.filter((utxo) => {
    if (filter.keychain !== 'all' && utxo.keychain !== filter.keychain) {
      return false
    }
    if (filter.script !== 'all' && getUtxoScriptType(utxo) !== filter.script) {
      return false
    }
    const { label, tags } = parseLabel(utxo.label || '')
    const hasLabelText = Boolean(label.trim())
    if (filter.label === 'labeled' && !hasLabelText) {
      return false
    }
    if (filter.label === 'unlabeled' && hasLabelText) {
      return false
    }
    const hasTags = tags.length > 0
    if (filter.tag === 'tagged' && !hasTags) {
      return false
    }
    if (filter.tag === 'untagged' && hasTags) {
      return false
    }
    return true
  })
}

function sortUtxosByField(
  utxos: Utxo[],
  field: UtxoSortField,
  direction: Direction
): Utxo[] {
  const sign = direction === 'asc' ? 1 : -1
  return utxos.toSorted((utxo1, utxo2) => {
    const result =
      field === 'date'
        ? compareTimestamp(utxo1.timestamp, utxo2.timestamp)
        : field === 'amount'
          ? compareAmount(utxo1.value, utxo2.value)
          : compareLabel(utxo1.label, utxo2.label)
    return result * sign
  })
}

function groupEntriesForMode(
  mode: UtxoGroupMode,
  utxo: Utxo
): { key: string; title: string }[] {
  if (mode === 'address') {
    const address = (utxo.addressTo || '').trim()
    return [
      {
        key: address || getUtxoOutpoint(utxo),
        title: address || getUtxoOutpoint(utxo)
      }
    ]
  }
  if (mode === 'label') {
    const { label } = parseLabel(utxo.label || '')
    const text = label.trim()
    return [
      {
        key: text ? `label:${text}` : 'label:',
        title: text
      }
    ]
  }
  if (mode === 'tag') {
    const { tags } = parseLabel(utxo.label || '')
    if (tags.length === 0) {
      return [{ key: 'tag:', title: '' }]
    }
    // First tag in label order; avoid duplicating multi-tag UTXOs.
    const [tag] = tags
    return [{ key: `tag:${tag}`, title: tag }]
  }
  if (mode === 'keychain') {
    return [
      {
        key: utxo.keychain,
        title: utxo.keychain
      }
    ]
  }
  return [{ key: 'none', title: '' }]
}

function groupUtxos(utxos: Utxo[], mode: UtxoGroupMode): UtxoGroup[] {
  if (mode === 'none') {
    return [{ key: 'none', title: '', utxos }]
  }

  const groups = new Map<string, UtxoGroup>()
  for (const utxo of utxos) {
    for (const { key, title } of groupEntriesForMode(mode, utxo)) {
      const existing = groups.get(key)
      if (existing) {
        existing.utxos.push(utxo)
      } else {
        groups.set(key, { key, title, utxos: [utxo] })
      }
    }
  }

  return Array.from(groups.values()).toSorted((a, b) => {
    if (!a.title && b.title) {
      return 1
    }
    if (a.title && !b.title) {
      return -1
    }
    return a.title.localeCompare(b.title)
  })
}

function prepareUtxoList(options: {
  utxos: Utxo[]
  excludedOutpoints?: Iterable<string>
  /** When false, excluded UTXOs stay in the list (for toggle UI). Default true. */
  hideExcluded?: boolean
  filter?: UtxoListFilter
  groupMode?: UtxoGroupMode
  sortField?: UtxoSortField
  sortDirection?: Direction
}): UtxoGroup[] {
  const {
    utxos,
    excludedOutpoints = [],
    hideExcluded = true,
    filter = DEFAULT_UTXO_LIST_FILTER,
    groupMode = 'none',
    sortField = 'amount',
    sortDirection = 'desc'
  } = options

  const eligible = hideExcluded
    ? applyUtxoDenylist(utxos, excludedOutpoints)
    : utxos
  const filtered = filterUtxos(eligible, filter)
  const groups = groupUtxos(filtered, groupMode)
  return groups.map((group) => ({
    ...group,
    utxos: sortUtxosByField(group.utxos, sortField, sortDirection)
  }))
}

export {
  applyUtxoDenylist,
  DEFAULT_UTXO_LIST_FILTER,
  filterUtxos,
  groupUtxos,
  isUtxoExcluded,
  prepareUtxoList,
  pruneExcludedOutpoints,
  sortUtxosByField
}

export type {
  UtxoGroup,
  UtxoGroupMode,
  UtxoKeychainFilter,
  UtxoLabelFilter,
  UtxoListFilter,
  UtxoScriptFilter,
  UtxoSortField,
  UtxoTagFilter
}
