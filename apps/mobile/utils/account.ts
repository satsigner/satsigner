import { useAuthStore } from '@/store/auth'
import { type Account, type Key } from '@/types/models/Account'
import { aesDecrypt, getPinForDecryption } from '@/utils/crypto'

import { getUtxoOutpoint } from './utxo'

const MAX_DAYS_WITHOUT_SYNCING = 3

// update labels in the field transactions, utxos, and addresses
// using the field labels.
export function updateAccountObjectLabels(account: Account) {
  const labels = { ...account.labels }
  const updatedAccount: Account = { ...account }

  // utxo labels update
  for (const index in updatedAccount.utxos) {
    const utxo = updatedAccount.utxos[index]
    const utxoRef = getUtxoOutpoint(utxo)
    let label = labels[utxoRef]?.label
    // fall back to utxo's address's label
    if (!label && utxo.addressTo) {
      label = labels[utxo.addressTo]?.label
    }
    // save label inherited from address
    if (label && !labels[utxoRef]) {
      labels[utxoRef] = {
        type: 'output',
        ref: utxoRef,
        label
      }
    }
    updatedAccount.utxos[index].label = label || ''
  }

  // TX label update
  for (const index in updatedAccount.transactions) {
    const tx = updatedAccount.transactions[index]
    const { id: txRef, vout, vin } = tx
    let label = labels[txRef]?.label

    // fall back to tx's address' label
    if (!label && tx.vout.length > 0) {
      label = ''
      for (const output of tx.vout) {
        const outputAddress = output.address
        const outputLabel = labels[outputAddress]?.label
        if (!outputLabel) continue
        label += outputLabel + ','
      }
      label = label.replace(/,$/, '')
    }

    // save label inherited from address
    if (label && !labels[txRef]) {
      labels[txRef] = {
        type: 'tx',
        ref: txRef,
        label
      }
    }

    updatedAccount.transactions[index].label = label || ''

    updatedAccount.transactions[index].vout = vout.map((output, vout) => {
      const outputRef = `${tx.id}:${vout}`
      let outputLabel = labels[outputRef]?.label || ''
      if (!outputLabel && label) {
        outputLabel = `${label} (output ${vout})`
      }
      return {
        ...output,
        label: outputLabel
      }
    })

    updatedAccount.transactions[index].vin = vin.map((input, vin) => {
      const { txid, vout } = input.previousOutput
      const inputRef = `${txid}:${vout}`
      let inputLabel = labels[inputRef]?.label
      if (!inputLabel && label) {
        inputLabel = `${label} (input ${vin})`
      }
      return {
        ...input,
        label: inputLabel
      }
    })
  }

  // address label update
  for (const index in updatedAccount.addresses) {
    const addressRef = updatedAccount.addresses[index].address
    const label = labels[addressRef]?.label
    updatedAccount.addresses[index].label = label || ''
  }

  // update labels with possible new labels inherited from receive address
  updatedAccount.labels = { ...labels }

  return updatedAccount
}

export function extractAccountFingerprint(
  account: Account,
  decryptedKeys?: Key[]
): string {
  if (!account?.keys?.length) {
    return ''
  }

  const firstKey = account.keys[0]

  if (decryptedKeys && decryptedKeys.length > 0) {
    const decryptedKey = decryptedKeys[0]
    if (decryptedKey) {
      if (
        typeof decryptedKey.secret === 'object' &&
        decryptedKey.secret.fingerprint
      ) {
        return decryptedKey.secret.fingerprint
      }
      if (decryptedKey.fingerprint) {
        return decryptedKey.fingerprint
      }
    }
  }

  if (typeof firstKey.secret === 'object' && firstKey.secret.fingerprint) {
    return firstKey.secret.fingerprint
  }

  if (firstKey.fingerprint) {
    return firstKey.fingerprint
  }

  return ''
}

export async function extractAccountFingerprintWithDecryption(
  account: Account
): Promise<string> {
  if (!account?.keys?.length) {
    return ''
  }

  const firstKey = account.keys[0]

  if (firstKey.fingerprint) {
    return firstKey.fingerprint
  }

  if (typeof firstKey.secret === 'object' && firstKey.secret.fingerprint) {
    return firstKey.secret.fingerprint
  }

  if (typeof firstKey.secret === 'string') {
    try {
      const skipPin = useAuthStore.getState().skipPin
      const pin = await getPinForDecryption(skipPin)
      if (!pin) {
        return ''
      }

      const decryptedSecretString = await aesDecrypt(
        firstKey.secret,
        pin,
        firstKey.iv
      )
      const decryptedSecret = JSON.parse(decryptedSecretString)

      if (decryptedSecret.fingerprint) {
        return decryptedSecret.fingerprint
      }
    } catch {
      // Decryption failed
      return ''
    }
  }

  return ''
}

export async function extractKeyFingerprint(key: Key): Promise<string> {
  if (typeof key.secret === 'object' && key.secret.fingerprint) {
    return key.secret.fingerprint
  }

  if (typeof key.secret === 'string') {
    try {
      const skipPin = useAuthStore.getState().skipPin
      const pin = await getPinForDecryption(skipPin)
      if (!pin) {
        return ''
      }

      const decryptedSecretString = await aesDecrypt(key.secret, pin, key.iv)
      const decryptedSecret = JSON.parse(decryptedSecretString)

      return decryptedSecret.fingerprint || ''
    } catch {
      return ''
    }
  }

  return key.fingerprint || ''
}

export function checkWalletNeedsSync(
  account: Account,
  maxDaysWithoutSyncing: number = MAX_DAYS_WITHOUT_SYNCING
): boolean {
  if (account.lastSyncedAt === undefined) {
    return true
  }

  let lastSync: Date
  try {
    const lastSyncedAtValue = account.lastSyncedAt

    if (lastSyncedAtValue instanceof Date) {
      lastSync = lastSyncedAtValue
    } else {
      // If it's a string or number, try to create a Date
      lastSync = new Date(lastSyncedAtValue)

      // Check if the date is valid
      if (isNaN(lastSync.getTime())) {
        // Invalid lastSyncedAt value, needs sync
        return true
      }
    }
  } catch {
    // Error parsing lastSyncedAt, needs sync
    return true
  }

  const now = new Date()

  // Discard the time and time-zone information.
  const currentUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  const lastSyncedUtc = Date.UTC(
    lastSync.getFullYear(),
    lastSync.getMonth(),
    lastSync.getDate()
  )

  const MILISECONDS_PER_DAY = 1000 * 60 * 60 * 24
  const daysSinceLastSync = Math.floor(
    (currentUtc - lastSyncedUtc) / MILISECONDS_PER_DAY
  )

  // Account updated too long ago.
  return daysSinceLastSync > maxDaysWithoutSyncing
}
