import { deleteArkLabelsByAccount, setArkLabel } from '@/db/mutations/arkLabels'
import { getArkLabelsByAccount } from '@/db/queries/arkLabels'
import {
  deleteArkDatadir,
  writeArkDatadirFiles,
  type ArkDatadirFile
} from '@/storage/arkDatadir'
import { getArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import type { Label } from '@/types/bips/329'
import type {
  ArkAccount,
  ArkAccountStats,
  ArkBalance
} from '@/types/models/Ark'

export type ArkDatadirBackup = {
  files: ArkDatadirFile[]
}

export type ArkBackupSection = {
  accounts: ArkAccount[]
  balances?: Record<string, ArkBalance | undefined>
  datadirs?: Record<string, ArkDatadirBackup>
  labels?: Record<string, Record<string, Label>>
  mnemonics?: Record<string, string | null>
  stats?: Record<string, ArkAccountStats | undefined>
}

export async function collectArkBackup(): Promise<ArkBackupSection> {
  const { accounts, balances, stats } = useArkStore.getState()
  const mnemonics = Object.fromEntries(
    await Promise.all(
      accounts.map(async (account) => [
        account.id,
        await getArkMnemonic(account.id)
      ])
    )
  )
  const labels = Object.fromEntries(
    accounts.map((account) => [account.id, getArkLabelsByAccount(account.id)])
  )
  return {
    accounts,
    balances,
    labels,
    mnemonics,
    stats
  }
}

export function restoreArkStoreFromBackup(
  data: ArkBackupSection | undefined
): void {
  const store = useArkStore.getState()
  store.clearAllData()
  if (!data) {
    return
  }
  for (const account of data.accounts ?? []) {
    store.addAccount(account)
  }
  if (data.balances) {
    for (const [accountId, balance] of Object.entries(data.balances)) {
      if (balance) {
        store.updateBalance(accountId, balance)
      }
    }
  }
  if (data.stats) {
    for (const [accountId, stats] of Object.entries(data.stats)) {
      if (stats) {
        store.updateStats(accountId, stats)
      }
    }
  }
}

export function restoreArkLabelsFromBackup(
  labels: Record<string, Record<string, Label>> | undefined,
  leftoverAccountIds: string[],
  restoredAccountIds: string[]
): void {
  for (const accountId of leftoverAccountIds) {
    deleteArkLabelsByAccount(accountId)
  }
  for (const accountId of restoredAccountIds) {
    deleteArkLabelsByAccount(accountId)
    const accountLabels = labels?.[accountId] ?? {}
    for (const label of Object.values(accountLabels)) {
      if (!label.ref || !label.type) {
        continue
      }
      setArkLabel(accountId, label.ref, label.type, label.label)
    }
  }
}

export function prepareArkMnemonics(
  mnemonics: Record<string, string | null> | undefined
): { accountId: string; mnemonic: string }[] {
  if (!mnemonics) {
    return []
  }
  return Object.entries(mnemonics)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([accountId, mnemonic]) => ({ accountId, mnemonic }))
}

export async function restoreArkDatadirsFromBackup(
  datadirs: Record<string, ArkDatadirBackup> | undefined,
  leftoverAccountIds: string[],
  restoredAccountIds: string[]
): Promise<void> {
  await Promise.all(
    leftoverAccountIds.map((accountId) =>
      deleteArkDatadir(accountId).catch(() => undefined)
    )
  )
  for (const accountId of restoredAccountIds) {
    const files = datadirs?.[accountId]?.files ?? []
    await writeArkDatadirFiles(accountId, files)
  }
}
