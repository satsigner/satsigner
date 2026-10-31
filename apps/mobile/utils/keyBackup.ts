import { type Key, type Secret } from '@/types/models/Account'
import { isPrivateKeyHex, wifImportSecret } from '@/utils/wif'

type BackupKeySecret = {
  passphrase?: string
  privateKey?: string
  privateKeyCompressed?: boolean
  seedWords?: string
}

type BackupKeyWithSecret = BackupKeySecret &
  Pick<Key, 'creationType' | 'scriptVersion'>

function backupKeySecretFields(secret: Secret): BackupKeySecret {
  return {
    ...(secret.passphrase !== undefined && { passphrase: secret.passphrase }),
    ...(secret.mnemonic !== undefined && { seedWords: secret.mnemonic }),
    ...(secret.privateKey !== undefined && { privateKey: secret.privateKey }),
    ...(secret.privateKeyCompressed !== undefined && {
      privateKeyCompressed: secret.privateKeyCompressed
    })
  }
}

function hasBackupKeySecret(key: Record<string, unknown>) {
  return (
    key.seedWords !== undefined ||
    key.passphrase !== undefined ||
    key.privateKey !== undefined
  )
}

function seedSecretFromBackup(key: BackupKeySecret) {
  if (key.seedWords === undefined && key.passphrase === undefined) {
    return
  }
  return {
    ...(key.seedWords !== undefined && { mnemonic: key.seedWords }),
    ...(key.passphrase !== undefined && { passphrase: key.passphrase })
  }
}

function wifSecretFromBackup(key: BackupKeyWithSecret) {
  const { privateKey, privateKeyCompressed, scriptVersion } = key
  if (
    privateKey === undefined ||
    privateKeyCompressed === undefined ||
    !scriptVersion ||
    !isPrivateKeyHex(privateKey)
  ) {
    return
  }
  return wifImportSecret(
    { compressed: privateKeyCompressed, ok: true, privateKeyHex: privateKey },
    scriptVersion
  )
}

function secretFromBackupKey(key: BackupKeyWithSecret) {
  if (key.creationType === 'importWif') {
    return wifSecretFromBackup(key)
  }
  return seedSecretFromBackup(key)
}

export {
  type BackupKeySecret,
  backupKeySecretFields,
  hasBackupKeySecret,
  secretFromBackupKey
}
