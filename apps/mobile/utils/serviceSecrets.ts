import {
  deleteLndConfigSecret,
  deleteRpcCredentialsSecret,
  getLndConfigSecret,
  getRpcCredentialsSecret,
  storeLndConfigSecret,
  storeRpcCredentialsSecret
} from '@/storage/encrypted'
import type { LNDConfig } from '@/types/models/Lightning'
import { type Network, type RpcCredentials } from '@/types/settings/blockchain'
import { aesDecrypt, aesEncrypt, getPin, randomIv } from '@/utils/crypto'

const BLOCKCHAIN_NETWORKS: Network[] = ['bitcoin', 'testnet', 'signet']

type LndSecretPayload = {
  cert: string
  macaroon: string
}

function stripLndSecrets(config: LNDConfig): LNDConfig {
  return {
    ...config,
    cert: '',
    macaroon: ''
  }
}

async function encryptAndStoreLndSecrets(
  config: LNDConfig,
  pin?: string
): Promise<void> {
  if (!config.macaroon && !config.cert) {
    await deleteLndConfigSecret()
    return
  }
  const key = pin ?? (await getPin())
  const iv = randomIv()
  const payload: LndSecretPayload = {
    cert: config.cert,
    macaroon: config.macaroon
  }
  const ciphertext = await aesEncrypt(JSON.stringify(payload), key, iv)
  await storeLndConfigSecret(ciphertext, iv)
}

async function loadLndSecrets(pin?: string): Promise<LndSecretPayload | null> {
  const stored = await getLndConfigSecret()
  if (!stored) {
    return null
  }
  const key = pin ?? (await getPin())
  const decrypted = await aesDecrypt(stored.secret, key, stored.iv)
  return JSON.parse(decrypted) as LndSecretPayload
}

async function encryptAndStoreRpcCredentials(
  network: Network,
  credentials: RpcCredentials,
  pin?: string
): Promise<void> {
  if (!credentials.username && !credentials.password) {
    await deleteRpcCredentialsSecret(network)
    return
  }
  const key = pin ?? (await getPin())
  const iv = randomIv()
  const ciphertext = await aesEncrypt(JSON.stringify(credentials), key, iv)
  await storeRpcCredentialsSecret(network, ciphertext, iv)
}

async function loadRpcCredentials(
  network: Network,
  pin?: string
): Promise<RpcCredentials | null> {
  const stored = await getRpcCredentialsSecret(network)
  if (!stored) {
    return null
  }
  const key = pin ?? (await getPin())
  const decrypted = await aesDecrypt(stored.secret, key, stored.iv)
  return JSON.parse(decrypted) as RpcCredentials
}

async function persistLndSecretsSafe(config: LNDConfig): Promise<void> {
  try {
    await encryptAndStoreLndSecrets(config)
  } catch {
    // best-effort from sync store actions
  }
}

async function persistRpcCredentialsSafe(
  network: Network,
  credentials: RpcCredentials
): Promise<void> {
  try {
    await encryptAndStoreRpcCredentials(network, credentials)
  } catch {
    // best-effort from sync store actions
  }
}

async function deleteLndSecretsSafe(): Promise<void> {
  try {
    await deleteLndConfigSecret()
  } catch {
    // best-effort cleanup
  }
}

async function deleteAllRpcCredentialsSafe(): Promise<void> {
  for (const network of BLOCKCHAIN_NETWORKS) {
    try {
      await deleteRpcCredentialsSecret(network)
    } catch {
      // best-effort cleanup
    }
  }
}

/**
 * Move plaintext LND/RPC secrets from MMKV into PIN-encrypted SecureStore and
 * hydrate them into in-memory store state for the unlocked session.
 */
async function migrateAndHydrateServiceSecrets(): Promise<void> {
  let pin: string
  try {
    pin = await getPin()
  } catch {
    return
  }

  const { useLightningStore } = await import('@/store/lightning')
  const { useBlockchainStore } = await import('@/store/blockchain')

  const lightning = useLightningStore.getState()
  if (lightning.config) {
    const hasPlaintext =
      Boolean(lightning.config.macaroon) || Boolean(lightning.config.cert)
    if (hasPlaintext) {
      await encryptAndStoreLndSecrets(lightning.config, pin)
      // Re-set so persist middleware rewrites MMKV without secrets.
      useLightningStore.setState({ config: lightning.config })
    } else {
      const loaded = await loadLndSecrets(pin)
      if (loaded) {
        useLightningStore.setState({
          config: {
            ...lightning.config,
            cert: loaded.cert,
            macaroon: loaded.macaroon
          }
        })
      }
    }
  }

  const blockchain = useBlockchainStore.getState()
  for (const network of BLOCKCHAIN_NETWORKS) {
    const { server } = blockchain.configs[network]
    const plaintext = server.rpcCredentials
    if (plaintext?.username || plaintext?.password) {
      await encryptAndStoreRpcCredentials(network, plaintext, pin)
      // Re-set so persist middleware rewrites MMKV without credentials.
      blockchain.updateServer(network, {
        ...server,
        rpcCredentials: plaintext
      })
      continue
    }
    const loaded = await loadRpcCredentials(network, pin)
    if (!loaded) {
      continue
    }
    blockchain.updateServer(network, {
      ...server,
      rpcCredentials: loaded
    })
  }
}

async function reEncryptServiceSecrets(
  oldPinEncrypted: string,
  newPinEncrypted: string
): Promise<void> {
  const lndStored = await getLndConfigSecret()
  if (lndStored) {
    const decrypted = await aesDecrypt(
      lndStored.secret,
      oldPinEncrypted,
      lndStored.iv
    )
    const payload = JSON.parse(decrypted) as LndSecretPayload
    await encryptAndStoreLndSecrets(
      { cert: payload.cert, macaroon: payload.macaroon, url: '' },
      newPinEncrypted
    )
  }

  for (const network of BLOCKCHAIN_NETWORKS) {
    const stored = await getRpcCredentialsSecret(network)
    if (!stored) {
      continue
    }
    const decrypted = await aesDecrypt(
      stored.secret,
      oldPinEncrypted,
      stored.iv
    )
    const credentials = JSON.parse(decrypted) as RpcCredentials
    await encryptAndStoreRpcCredentials(network, credentials, newPinEncrypted)
  }
}

export {
  deleteAllRpcCredentialsSafe,
  deleteLndSecretsSafe,
  loadLndSecrets,
  loadRpcCredentials,
  migrateAndHydrateServiceSecrets,
  persistLndSecretsSafe,
  persistRpcCredentialsSafe,
  reEncryptServiceSecrets,
  stripLndSecrets
}
