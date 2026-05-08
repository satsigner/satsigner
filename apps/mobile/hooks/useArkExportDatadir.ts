import { useState } from 'react'

import { syncArkWallet } from '@/api/ark'
import { t } from '@/locales'
import { findArkDbFile } from '@/storage/arkDatadir'
import type { ArkAccount } from '@/types/models/Ark'
import { saveExistingFile } from '@/utils/filesystem'

const DB_MIME_TYPE = 'application/octet-stream'

function basenameFromUri(uri: string): string {
  const lastSlash = uri.lastIndexOf('/')
  return lastSlash === -1 ? uri : uri.slice(lastSlash + 1)
}

export function useArkExportDatadir() {
  const [isExporting, setIsExporting] = useState(false)

  async function exportDb(account: ArkAccount): Promise<void> {
    setIsExporting(true)
    try {
      await syncArkWallet(account.serverId, account.id)
      const dbUri = await findArkDbFile(account.id)
      if (!dbUri) {
        throw new Error(t('ark.error.exportDbNotFound'))
      }
      await saveExistingFile({
        dialogTitle: t('ark.account.exportDb'),
        filename: basenameFromUri(dbUri),
        mimeType: DB_MIME_TYPE,
        srcUri: dbUri
      })
    } finally {
      setIsExporting(false)
    }
  }

  return { exportDb, isExporting }
}
