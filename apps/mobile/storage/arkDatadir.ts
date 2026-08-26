import * as FileSystem from 'expo-file-system/legacy'

import { assertSafePathSegment } from '@/utils/safePath'

const ARK_DIR = `${FileSystem.documentDirectory}ark/`

export type ArkDatadirFile = {
  base64: string
  filename: string
}

function uriToPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri
}

function getArkDatadirUri(accountId: string): string {
  const safeId = assertSafePathSegment(accountId, 'ark account id')
  return `${ARK_DIR}${safeId}/`
}

async function ensureArkDatadir(accountId: string): Promise<string> {
  const uri = getArkDatadirUri(accountId)
  const info = await FileSystem.getInfoAsync(uri)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true })
  }
  return uriToPath(uri)
}

async function deleteArkDatadir(accountId: string): Promise<void> {
  const uri = getArkDatadirUri(accountId)
  const info = await FileSystem.getInfoAsync(uri)
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true })
  }
}

function getArkDatadirPath(accountId: string): string {
  return uriToPath(getArkDatadirUri(accountId))
}

const SQLITE_SIDECAR_SUFFIXES = ['-wal', '-shm', '-journal']
const SAFE_DATADIR_FILENAME = /^[A-Za-z0-9._-]+$/

function isMainSqliteFile(name: string): boolean {
  if (!name.endsWith('.db') && !name.endsWith('.sqlite')) {
    return false
  }
  return !SQLITE_SIDECAR_SUFFIXES.some((suffix) => name.includes(suffix))
}

function isDatadirBackupFile(name: string): boolean {
  if (!SAFE_DATADIR_FILENAME.test(name)) {
    return false
  }
  if (isMainSqliteFile(name)) {
    return true
  }
  return SQLITE_SIDECAR_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

async function findArkDbFile(accountId: string): Promise<string | null> {
  const dirUri = getArkDatadirUri(accountId)
  const info = await FileSystem.getInfoAsync(dirUri)
  if (!info.exists) {
    return null
  }
  const entries = await FileSystem.readDirectoryAsync(dirUri)
  const dbFile = entries.find(isMainSqliteFile)
  return dbFile ? `${dirUri}${dbFile}` : null
}

async function readArkDatadirFiles(
  accountId: string
): Promise<ArkDatadirFile[]> {
  const dirUri = getArkDatadirUri(accountId)
  const info = await FileSystem.getInfoAsync(dirUri)
  if (!info.exists) {
    return []
  }
  const entries = await FileSystem.readDirectoryAsync(dirUri)
  const files: ArkDatadirFile[] = []
  for (const filename of entries) {
    if (!isDatadirBackupFile(filename)) {
      continue
    }
    const base64 = await FileSystem.readAsStringAsync(`${dirUri}${filename}`, {
      encoding: FileSystem.EncodingType.Base64
    })
    files.push({ base64, filename })
  }
  return files
}

async function writeArkDatadirFiles(
  accountId: string,
  files: ArkDatadirFile[]
): Promise<void> {
  await deleteArkDatadir(accountId)
  if (files.length === 0) {
    await ensureArkDatadir(accountId)
    return
  }
  const dirUri = getArkDatadirUri(accountId)
  await ensureArkDatadir(accountId)
  for (const file of files) {
    const filename = assertSafePathSegment(file.filename, 'ark datadir file')
    if (!isDatadirBackupFile(filename)) {
      throw new Error(`Invalid ark datadir file: ${filename}`)
    }
    await FileSystem.writeAsStringAsync(`${dirUri}${filename}`, file.base64, {
      encoding: FileSystem.EncodingType.Base64
    })
  }
}

export {
  deleteArkDatadir,
  ensureArkDatadir,
  findArkDbFile,
  getArkDatadirPath,
  readArkDatadirFiles,
  writeArkDatadirFiles
}
