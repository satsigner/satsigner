import * as FileSystem from 'expo-file-system/legacy'

const ARK_DIR = `${FileSystem.documentDirectory}ark/`

function uriToPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri
}

function getArkDatadirUri(accountId: string): string {
  return `${ARK_DIR}${accountId}/`
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

export { deleteArkDatadir, ensureArkDatadir, getArkDatadirPath }
