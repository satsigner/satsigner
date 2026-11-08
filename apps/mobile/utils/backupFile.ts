import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'

import {
  BACKUP_FILE_MIME_TYPE,
  MAX_BACKUP_FILE_BYTES,
  MAX_BACKUP_INPUT_CHARS
} from '@/constants/backup'

export type LoadedBackup = {
  sizeBytes: number
  text: string
}

export type LoadBackupResult =
  | { status: 'cancelled' }
  | { status: 'tooLarge' }
  | { backup: LoadedBackup; status: 'loaded' }

export function isBackupTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_BACKUP_FILE_BYTES
}

export function shouldHoldBackupOffscreen(text: string): boolean {
  return text.length > MAX_BACKUP_INPUT_CHARS
}

export function loadBackupText(text: string): LoadBackupResult {
  const sizeBytes = new TextEncoder().encode(text).length
  if (isBackupTooLarge(sizeBytes)) {
    return { status: 'tooLarge' }
  }
  return { backup: { sizeBytes, text }, status: 'loaded' }
}

export async function pickBackupFile(): Promise<LoadBackupResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: BACKUP_FILE_MIME_TYPE
  })
  const asset = picked.canceled ? undefined : picked.assets?.[0]
  if (!asset) {
    return { status: 'cancelled' }
  }
  if (asset.size !== undefined && isBackupTooLarge(asset.size)) {
    return { status: 'tooLarge' }
  }
  const text = await FileSystem.readAsStringAsync(asset.uri)
  return loadBackupText(text)
}
