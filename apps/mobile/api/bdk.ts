import * as FileSystem from 'expo-file-system/legacy'
import {
  BdkRpcClient,
  BdkWallet,
  BdkTxBuilder,
  createPublicDescriptor,
  DescriptorTemplate,
  KeychainKind,
  type Network,
  Psbt,
  type PsbtLike,
  walletNameFromDescriptor,
  type AddressInfo
} from 'react-native-bdk-sdk'

import { BDK_RPC_PROGRESS_THROTTLE_MS } from '@/constants/bdk'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  type Backend,
  type Network as BlockchainNetwork,
  type RpcCredentials,
  type Server
} from '@/types/settings/blockchain'
import {
  getExtendedKeyFromDescriptor,
  getFingerprintFromExtendedPublicKey,
  getPublicDescriptorFromSeed
} from '@/utils/bip32'
import {
  detectElectrumSeed,
  getPrivateDescriptorFromElectrumMnemonic,
  getPrivateDescriptorFromMnemonic,
  mnemonicToSeed
} from '@/utils/bip39'
import {
  getMultisigDerivationPathFromScriptVersion,
  getMultisigScriptTypeFromScriptVersion
} from '@/utils/bitcoin'
import {
  descriptorHasPrivateKeyMaterial,
  getDescriptorDerivationPath,
  getFingerprint,
  PrivateKeyDescriptorError
} from '@/utils/descriptor'
import { estimateBirthHeight } from '@/utils/rpcScanStartHeight'
import { isCombinedDescriptor } from '@/utils/validation'

import { toAppNetwork } from './bdkWalletMappers'
import AppElectrumClient from './electrum'
import Esplora from './esplora'
import BitcoinRpc, { adjustRpcUrl, BitcoinCoreWallet } from './rpc'

const WALLETS_DIR = `${FileSystem.documentDirectory}wallets/`

async function ensureWalletsDir() {
  const dirInfo = await FileSystem.getInfoAsync(WALLETS_DIR)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(WALLETS_DIR, { intermediates: true })
  }
}

// expo-file-system returns file:// URIs on Android, but Rust's SQLite
// expects a plain filesystem path. Strip the scheme if present.
function uriToPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri
}

async function getWalletDbPath(
  externalDescriptor: string,
  internalDescriptor: string | undefined,
  network: Network
): Promise<string> {
  await ensureWalletsDir()
  const name = walletNameFromDescriptor(
    externalDescriptor,
    internalDescriptor,
    network
  )
  return uriToPath(`${WALLETS_DIR}${name}.sqlite`)
}

type WalletData = {
  dbPath: string
  derivationPath: string
  externalDescriptor: string
  fingerprint: string
  internalDescriptor: string
  keyFingerprints?: string[] // Optional for multisig accounts
  wallet: BdkWallet
}

async function getWalletData(
  account: Account,
  network: Network
): Promise<WalletData | undefined> {
  switch (account.policyType) {
    case 'singlesig': {
      if (account.keys.length !== 1) {
        throw new Error('Invalid key count for singlesig')
      }

      const [key] = account.keys

      if (
        key.creationType === 'generateMnemonic' ||
        key.creationType === 'importMnemonic'
      ) {
        if (
          typeof key.secret === 'string' ||
          !key.secret.mnemonic ||
          !key.scriptVersion
        ) {
          throw new Error('Invalid secret')
        }

        const walletData = await getWalletDataFromMnemonic(
          key.secret.mnemonic,
          key.scriptVersion,
          key.secret.passphrase,
          network
        )

        return walletData
      } else if (key.creationType === 'importDescriptor') {
        if (typeof key.secret === 'string' || !key.secret.externalDescriptor) {
          throw new Error('Invalid secret')
        }

        const { externalDescriptor } = key.secret
        const { internalDescriptor } = key.secret

        const parsedDescriptor = parseDescriptor(externalDescriptor)
        const { wallet, dbPath } = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          dbPath,
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor,
          fingerprint: parsedDescriptor.fingerprint,
          internalDescriptor: internalDescriptor || '',
          wallet
        }
      }
      break
    }
    case 'multisig': {
      // Get script version from the first key (all keys should have the same script version)
      const scriptVersion = account.keys[0]?.scriptVersion || 'P2WSH'
      const multisigScriptType =
        getMultisigScriptTypeFromScriptVersion(scriptVersion)

      const keyData = await Promise.all(
        account.keys.map((key, keyIndex) => {
          let extendedPublicKey = ''
          let fingerprint = ''

          if (typeof key.secret === 'object') {
            fingerprint =
              (typeof key.secret === 'object' && key.secret.fingerprint) ||
              key.fingerprint ||
              ''

            if (key.secret.extendedPublicKey) {
              ;({ extendedPublicKey } = key.secret)
            } else if (key.secret.externalDescriptor) {
              try {
                const extractedKey = getExtendedKeyFromDescriptor(
                  key.secret.externalDescriptor
                )
                if (extractedKey) {
                  extendedPublicKey = extractedKey
                }
              } catch {
                // Failed to extract extended public key
              }
            }
          }

          if (!fingerprint && extendedPublicKey) {
            fingerprint = getFingerprintFromExtendedPublicKey(extendedPublicKey)
          }

          return { extendedPublicKey, fingerprint, index: keyIndex }
        })
      )

      const validKeyData = keyData.filter(
        (
          kd
        ): kd is {
          fingerprint: string
          extendedPublicKey: string
          index: number
        } =>
          kd !== null &&
          kd.fingerprint !== undefined &&
          kd.extendedPublicKey !== undefined
      )

      if (validKeyData.length !== account.keys.length) {
        throw new Error(
          `Failed to extract extended public keys from all keys (${validKeyData.length}/${account.keys.length})`
        )
      }

      const policyDerivationPath = getMultisigDerivationPathFromScriptVersion(
        scriptVersion,
        toAppNetwork(network)
      )

      const cleanPolicyPath = policyDerivationPath.replace(/^m\/?/i, '')

      const sortedKeyData = validKeyData.toSorted((a, b) =>
        a.extendedPublicKey.localeCompare(b.extendedPublicKey)
      )

      const keySection = sortedKeyData
        .map(
          ({ fingerprint, extendedPublicKey }) =>
            `[${fingerprint}/${cleanPolicyPath}]${extendedPublicKey}/<0;1>/*`
        )
        .join(',')

      let finalDescriptor = ''
      switch (multisigScriptType) {
        case 'P2SH': {
          finalDescriptor = `sh(sortedmulti(${account.keysRequired},${keySection}))`
          break
        }
        case 'P2SH-P2WSH': {
          finalDescriptor = `sh(wsh(sortedmulti(${account.keysRequired},${keySection})))`
          break
        }
        case 'P2WSH': {
          finalDescriptor = `wsh(sortedmulti(${account.keysRequired},${keySection}))`
          break
        }
        case 'P2TR': {
          finalDescriptor = `tr(sortedmulti(${account.keysRequired},${keySection}))`
          break
        }
        default: {
          finalDescriptor = `wsh(sortedmulti(${account.keysRequired},${keySection}))`
        }
      }

      const externalDescriptor = finalDescriptor.replace(/<0;1>/g, '0')
      const internalDescriptor = finalDescriptor.replace(/<0;1>/g, '1')

      const parsedDescriptor = parseDescriptor(externalDescriptor)

      const { wallet, dbPath } = await getWalletFromDescriptor(
        externalDescriptor,
        internalDescriptor,
        network
      )

      const keyFingerprints = validKeyData.map((kd) => kd.fingerprint)

      return {
        dbPath,
        derivationPath: parsedDescriptor.derivationPath,
        externalDescriptor: finalDescriptor,
        fingerprint: parsedDescriptor.fingerprint,
        internalDescriptor: '',
        keyFingerprints,
        wallet
      }
    }
    case 'watchonly': {
      if (account.keys.length !== 1) {
        throw new Error('Invalid key count for singlesig')
      }

      const [key] = account.keys

      if (key.creationType === 'importDescriptor') {
        if (typeof key.secret === 'string' || !key.secret.externalDescriptor) {
          throw new Error('Invalid secret')
        }

        const { externalDescriptor } = key.secret
        const { internalDescriptor } = key.secret

        const parsedDescriptor = parseDescriptor(externalDescriptor)
        const { wallet, dbPath } = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          dbPath,
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor,
          fingerprint: parsedDescriptor.fingerprint,
          internalDescriptor: internalDescriptor || '',
          wallet
        }
      } else if (key.creationType === 'importExtendedPub') {
        if (
          !key.scriptVersion ||
          typeof key.secret === 'string' ||
          !key.secret.fingerprint ||
          !key.secret.extendedPublicKey
        ) {
          throw new Error('Invalid account information')
        }

        const template = mapScriptVersionToBipTemplate(key.scriptVersion)

        const externalDescriptor = createPublicDescriptor(
          key.secret.extendedPublicKey,
          template,
          KeychainKind.External,
          network
        )
        const internalDescriptor = createPublicDescriptor(
          key.secret.extendedPublicKey,
          template,
          KeychainKind.Internal,
          network
        )

        const parsedDescriptor = parseDescriptor(externalDescriptor)
        const { wallet, dbPath } = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          dbPath,
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor,
          fingerprint: parsedDescriptor.fingerprint,
          internalDescriptor,
          wallet
        }
      } else if (key.creationType === 'importAddress') {
        // BDK does not support address descriptor
      }

      break
    }
    default: {
      break
    }
  }
}

function mapScriptVersionToBipTemplate(
  scriptVersion: NonNullable<Key['scriptVersion']>
): DescriptorTemplate {
  switch (scriptVersion) {
    case 'P2PKH': {
      return DescriptorTemplate.Bip44
    }
    case 'P2SH-P2WPKH': {
      return DescriptorTemplate.Bip49
    }
    case 'P2WPKH': {
      return DescriptorTemplate.Bip84
    }
    case 'P2TR': {
      return DescriptorTemplate.Bip86
    }
    case 'P2WSH':
    case 'P2SH-P2WSH':
    case 'P2SH': {
      throw new Error(
        `Manual descriptor creation required for ${scriptVersion}`
      )
    }
    default: {
      return DescriptorTemplate.Bip84
    }
  }
}

function getDescriptorMultiSig(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  kind: KeychainKind,
  passphrase: Secret['passphrase'],
  network: Network
): string {
  const baseString = getPrivateDescriptorFromMnemonic(
    mnemonic,
    'P2WPKH',
    kind,
    passphrase,
    network
  )
  const keyPart = baseString.replace(/^wpkh\(/, '').replace(/\)$/, '')

  switch (scriptVersion) {
    case 'P2WSH': {
      return `wsh(${keyPart})`
    }
    case 'P2SH-P2WSH': {
      return `sh(wsh(${keyPart}))`
    }
    case 'P2SH': {
      return `sh(${keyPart})`
    }
    default: {
      throw new Error(`Unsupported script version: ${scriptVersion}`)
    }
  }
}

async function getWalletDataFromMnemonic(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  passphrase: Secret['passphrase'],
  network: Network
) {
  const externalDescriptor = await getDescriptorString(
    mnemonic,
    scriptVersion,
    KeychainKind.External,
    passphrase,
    network
  )
  const internalDescriptor = await getDescriptorString(
    mnemonic,
    scriptVersion,
    KeychainKind.Internal,
    passphrase,
    network
  )

  const { fingerprint, derivationPath } = parseDescriptor(externalDescriptor)

  const { wallet, dbPath } = await getWalletFromDescriptor(
    externalDescriptor,
    internalDescriptor,
    network
  )

  return {
    dbPath,
    derivationPath,
    externalDescriptor,
    fingerprint,
    internalDescriptor,
    wallet
  }
}

function getDescriptorString(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  kind: KeychainKind,
  passphrase: Secret['passphrase'],
  network: Network
) {
  const electrumType = detectElectrumSeed(mnemonic)
  if (electrumType) {
    return getPrivateDescriptorFromElectrumMnemonic(
      mnemonic,
      electrumType,
      kind,
      passphrase || '',
      network
    )
  }

  if (
    scriptVersion === 'P2SH' ||
    scriptVersion === 'P2SH-P2WSH' ||
    scriptVersion === 'P2WSH'
  ) {
    return getDescriptorMultiSig(
      mnemonic,
      scriptVersion,
      kind,
      passphrase,
      network
    )
  }

  return getPrivateDescriptorFromMnemonic(
    mnemonic,
    scriptVersion,
    kind,
    passphrase,
    network
  )
}

function parseDescriptor(descriptorString: string) {
  if (!descriptorString) {
    return { derivationPath: '', fingerprint: '' }
  }
  return {
    derivationPath: getDescriptorDerivationPath(descriptorString),
    fingerprint: getFingerprint(descriptorString)
  }
}

function normalizeWalletDescriptor(descriptor: string) {
  return descriptor.replace(/#\w+$/, '').replace(/'/g, 'h')
}

function splitCombinedWalletDescriptors(
  externalDescriptor: string,
  internalDescriptor: string | undefined
) {
  const ext = normalizeWalletDescriptor(externalDescriptor)
  const int = internalDescriptor
    ? normalizeWalletDescriptor(internalDescriptor)
    : undefined
  if (!isCombinedDescriptor(ext)) {
    return { ext, int }
  }
  return {
    ext: ext.replace(/<0[,;]1>/g, '0'),
    int: ext.replace(/<0[,;]1>/g, '1')
  }
}

async function getWalletFromDescriptor(
  externalDescriptor: string,
  internalDescriptor: string | undefined,
  network: Network
): Promise<{ wallet: BdkWallet; dbPath: string }> {
  const { ext, int } = splitCombinedWalletDescriptors(
    externalDescriptor,
    internalDescriptor
  )
  const dbPath = await getWalletDbPath(ext, int, network)
  return { dbPath, wallet: new BdkWallet(ext, int, network, dbPath) }
}

async function getExtendedPublicKeyFromAccountKey(key: Key, network: Network) {
  if (
    typeof key.secret === 'string' ||
    !key.secret.mnemonic ||
    !key.scriptVersion
  ) {
    return
  }

  const externalDescriptor = await getDescriptorString(
    key.secret.mnemonic,
    key.scriptVersion,
    KeychainKind.External,
    key.secret.passphrase,
    network
  )
  return getExtendedKeyFromDescriptor(externalDescriptor)
}

function createThrottledRpcProgress(
  onRpcProgress: (current: number, tip: number, pct: number) => void
): (current: number, tip: number, pct: number) => void {
  let lastEmitMs = 0
  let pending: { current: number; pct: number; tip: number } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    timer = null
    if (!pending) {
      return
    }
    const { current, tip, pct } = pending
    pending = null
    lastEmitMs = Date.now()
    onRpcProgress(current, tip, pct)
  }

  return function emit(current: number, tip: number, pct: number) {
    const isComplete = pct >= 1 || (tip > 0 && current >= tip)
    if (isComplete) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pending = null
      lastEmitMs = Date.now()
      onRpcProgress(current, tip, pct)
      return
    }

    pending = { current, pct, tip }
    const elapsed = Date.now() - lastEmitMs
    if (elapsed >= BDK_RPC_PROGRESS_THROTTLE_MS) {
      flush()
      return
    }
    if (!timer) {
      timer = setTimeout(flush, BDK_RPC_PROGRESS_THROTTLE_MS - elapsed)
    }
  }
}

async function syncWallet(
  wallet: BdkWallet,
  backend: Backend,
  url: string,
  stopGap: number,
  isFullScan: boolean,
  rpcCredentials?: RpcCredentials,
  walletBirthday?: Date,
  currentTip?: number,
  rpcScanFromHeight?: number,
  isGeneratedWallet?: boolean,
  onRpcProgress?: (current: number, tip: number, pct: number) => void
) {
  if (backend === 'rpc') {
    const rpcClient = new BdkRpcClient({
      auth: rpcCredentials
        ? {
            password: rpcCredentials.password,
            type: 'userPass',
            username: rpcCredentials.username
          }
        : { type: 'none' },
      url: adjustRpcUrl(url)
    })

    // For a full scan use the wallet birthday as the start height.
    // Downloading full blocks from genesis would take hours; starting near
    // the wallet creation date keeps the scan practical.
    const checkpointHeight = wallet.latestCheckpoint()?.height ?? 0
    const scanFloor = rpcScanFromHeight ?? 0

    let startHeight: number
    if (!isFullScan) {
      startHeight = checkpointHeight
    } else if (isGeneratedWallet && walletBirthday && currentTip) {
      // For wallets we created, estimate backwards from the known chain tip.
      // This is accurate because we know exactly when the wallet was created.
      startHeight = Math.max(
        scanFloor,
        estimateBirthHeight(walletBirthday, currentTip)
      )
    } else {
      // For imported wallets the creation date is the import date, not the
      // actual wallet birthday. Use the server-configured floor (default 0).
      startHeight = scanFloor
    }

    const emitProgress = onRpcProgress
      ? createThrottledRpcProgress(onRpcProgress)
      : undefined

    await wallet.syncWithRpc(rpcClient, startHeight, {
      fetchMempool: true,
      inspector: {
        inspect({ currentHeight, tipHeight, progress }) {
          emitProgress?.(currentHeight, tipHeight, progress)
        }
      }
    })
  } else if (isFullScan) {
    await (backend === 'electrum'
      ? wallet.fullScanWithElectrum(url, stopGap)
      : wallet.fullScanWithEsplora(url, stopGap))
  } else if (backend === 'electrum') {
    await wallet.syncWithElectrum(url, stopGap)
  } else {
    await wallet.syncWithEsplora(url, stopGap)
  }

  wallet.persist()
}

async function getTransactionInputValues(
  tx: Transaction,
  backend: Backend,
  network: BlockchainNetwork,
  url: string,
  rpcCredentials?: RpcCredentials
): Promise<Transaction['vin']> {
  if (!tx.vin.some((input) => input.value === undefined)) {
    return tx.vin
  }

  let vin: Transaction['vin'] = []

  if (backend === 'electrum') {
    const electrumClient = await AppElectrumClient.initClientFromUrl(
      url,
      network
    )
    vin = await electrumClient.getTxInputValues(tx)
    electrumClient.close()
  }

  if (backend === 'esplora') {
    const esploraClient = new Esplora(url)
    const esploraVin = await esploraClient.getTxInputValues(tx.id)
    vin = esploraVin.map((input) => ({
      previousOutput: input.previousOutput,
      scriptSig: input.scriptSig,
      sequence: input.sequence,
      value: input.value,
      witness: input.witness || []
    }))
  }

  if (backend === 'rpc') {
    const rpcClient = new BitcoinRpc(
      url,
      rpcCredentials?.username ?? '',
      rpcCredentials?.password ?? ''
    )
    vin = await Promise.all(
      tx.vin.map(async (input) => {
        if (!input.previousOutput?.txid) {
          return input
        }
        try {
          const prevTx = await rpcClient.getRawTransaction(
            input.previousOutput.txid
          )
          const prevOut = prevTx.vout[input.previousOutput.vout ?? 0]
          return {
            ...input,
            value: prevOut
              ? Math.round(prevOut.value * SATS_PER_BITCOIN)
              : undefined
          }
        } catch {
          return input
        }
      })
    )
  }

  for (const [index, vinItem] of vin.entries()) {
    vin[index] = {
      ...tx.vin[index],
      ...vinItem
    }
  }

  return vin
}

function getLastUnusedAddressFromWallet(wallet: BdkWallet): AddressInfo {
  return wallet.nextUnusedAddress(KeychainKind.External)
}

/**
 * Build a PSBT via Bitcoin Core's wallet RPC (createpsbt + walletprocesspsbt)
 * then wrap it as a BDK PsbtLike so it can be signed by wallet.sign().
 *
 * This is the correct path for RPC backends because BDK's TxBuilder.finish()
 * requires UTXOs to be in BDK's keychain index (populated only by native BDK
 * sync). Since we bypass BDK sync for RPC, the keychain index is empty and
 * TxBuilder throws OutpointNotFound. Bitcoin Core's watch-only wallet already
 * knows the UTXOs (from importdescriptors + rescanblockchain), so we delegate
 * PSBT construction to it and only use BDK for key derivation / signing.
 */
// Converts an integer satoshi amount to a BTC decimal string-safe number,
// rounding to 8 decimal places to avoid binary floating-point drift
// (e.g. avoids values like 0.1 + 0.2 style representation errors).
function satsToBtc(sats: number): number {
  return Number((sats / SATS_PER_BITCOIN).toFixed(8))
}

// Resolves the Bitcoin Core wallet name to use for an account. Prefers the
// user-provided rpcWalletName (Settings > Server) so multiple accounts can
// share or target a specific already-existing Core wallet; otherwise falls
// back to a deterministic per-account name derived from the key fingerprint.
function resolveRpcWalletName(
  account: Account,
  rpcWalletName?: string
): string {
  const trimmed = rpcWalletName?.trim()
  if (trimmed) {
    return trimmed
  }
  const fingerprint = account.keys[0]?.fingerprint ?? account.id
  return `satsigner-${fingerprint}`
}

async function buildTransactionWithRpc(
  nodeUrl: string,
  credentials: RpcCredentials,
  walletName: string,
  data: {
    inputs: Utxo[]
    outputs: Output[]
    options: { rbf: boolean }
  }
): Promise<PsbtLike> {
  const coreWallet = new BitcoinCoreWallet(
    nodeUrl,
    credentials.username,
    credentials.password,
    walletName
  )

  const rpcInputs = data.inputs.map((u) => ({
    sequence: data.options.rbf ? 0xff_ff_ff_fd : 0xff_ff_ff_ff,
    txid: u.txid,
    vout: u.vout
  }))

  // Bitcoin Core's `createpsbt` takes an array of single-key {address: amount}
  // objects for its `outputs` param — each array element is a distinct output,
  // which is how the RPC lets multiple outputs share the same address. Merging
  // them into a single Record<address, number> would silently collapse
  // legitimate duplicate-address outputs into one. Sats are integers, so each
  // amount is converted to BTC exactly once (no repeated float accumulation).
  const rpcOutputs = data.outputs.map((o) => ({
    [o.to]: satsToBtc(o.amount)
  }))

  // Step 1: create unsigned PSBT
  const rawPsbt = await coreWallet.createPsbt(rpcInputs, rpcOutputs)

  // Step 2: walletprocesspsbt with sign=false to add witness_utxo and bip32_derivation
  // The watch-only Core wallet enriches the PSBT without trying to sign it.
  const processed = await coreWallet.walletProcessPsbt(rawPsbt)

  return new Psbt(processed.psbt)
}

function buildTransaction(
  wallet: BdkWallet,
  data: {
    inputs: Utxo[]
    outputs: Output[]
    fee: number
    options: {
      rbf: boolean
    }
  }
): Promise<PsbtLike> {
  const txBuilder = new BdkTxBuilder()

  txBuilder.addUtxos(
    data.inputs.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout }))
  )
  txBuilder.manuallySelectedOnly()

  for (const output of data.outputs) {
    txBuilder.addRecipient(output.to, output.amount)
  }

  txBuilder.feeAbsolute(data.fee)

  if (data.options.rbf) {
    txBuilder.enableRbf()
  }

  return txBuilder.finish(wallet)
}

function buildPsbt(
  wallet: BdkWallet,
  server: Server,
  account: Account,
  data: {
    fee: number
    inputs: Utxo[]
    outputs: Output[]
    options: { rbf: boolean }
  }
): Promise<PsbtLike> {
  const { backend, url, rpcCredentials, rpcWalletName } = server

  if (backend === 'rpc' && url && rpcCredentials) {
    const walletName = resolveRpcWalletName(account, rpcWalletName)
    return buildTransactionWithRpc(url, rpcCredentials, walletName, {
      inputs: data.inputs,
      options: data.options,
      outputs: data.outputs
    })
  }

  return buildTransaction(wallet, data)
}

function signTransaction(psbt: PsbtLike, wallet: BdkWallet): boolean {
  const signed = wallet.sign(psbt)
  wallet.persist()
  return signed
}

function broadcastTransaction(
  wallet: BdkWallet,
  psbt: PsbtLike,
  backend: Backend,
  url: string,
  rpcCredentials?: RpcCredentials
): Promise<string> {
  if (backend === 'electrum') {
    return wallet.broadcastWithElectrum(url, psbt)
  }
  if (backend === 'rpc') {
    const rpcClient = new BdkRpcClient({
      auth: rpcCredentials
        ? {
            password: rpcCredentials.password,
            type: 'userPass',
            username: rpcCredentials.username
          }
        : { type: 'none' },
      url: adjustRpcUrl(url)
    })
    return wallet.broadcastWithRpc(rpcClient, psbt)
  }
  return wallet.broadcastWithEsplora(url, psbt)
}

// ─── Bitcoin Core wallet sync (importdescriptors path) ───────────────────────

/**
 * Derive a pair of watch-only (public) descriptors for an account.
 * Used to import the wallet into Bitcoin Core's descriptor wallet.
 * Returns [externalDescriptor, internalDescriptor].
 */
function getPublicDescriptorsForAccount(
  account: Account,
  network: Network
): [string, string] | null {
  const [key] = account.keys
  if (!key) {
    return null
  }

  try {
    if (
      key.creationType === 'generateMnemonic' ||
      key.creationType === 'importMnemonic'
    ) {
      if (
        typeof key.secret === 'string' ||
        !key.secret.mnemonic ||
        !key.scriptVersion
      ) {
        return null
      }
      const seed = mnemonicToSeed(
        key.secret.mnemonic,
        key.secret.passphrase ?? ''
      )
      const external = getPublicDescriptorFromSeed(
        seed,
        key.scriptVersion,
        KeychainKind.External,
        network
      )
      const internal = getPublicDescriptorFromSeed(
        seed,
        key.scriptVersion,
        KeychainKind.Internal,
        network
      )
      return [external, internal]
    }

    if (key.creationType === 'importExtendedPub') {
      if (
        typeof key.secret === 'string' ||
        !key.secret.extendedPublicKey ||
        !key.scriptVersion
      ) {
        return null
      }
      const template = mapScriptVersionToBipTemplate(key.scriptVersion)
      const external = createPublicDescriptor(
        key.secret.extendedPublicKey,
        template,
        KeychainKind.External,
        network
      )
      const internal = createPublicDescriptor(
        key.secret.extendedPublicKey,
        template,
        KeychainKind.Internal,
        network
      )
      return [external, internal]
    }

    if (key.creationType === 'importDescriptor') {
      if (typeof key.secret === 'string' || !key.secret.externalDescriptor) {
        return null
      }
      const ext = key.secret.externalDescriptor
      const int = key.secret.internalDescriptor
      if (!int) {
        return null
      }
      // Imported descriptors may contain private key material (xprv/tprv/etc).
      // We must never forward that to a remote Bitcoin Core node just to
      // derive a watch-only import — refuse instead of silently leaking it.
      if (
        descriptorHasPrivateKeyMaterial(ext) ||
        descriptorHasPrivateKeyMaterial(int)
      ) {
        throw new PrivateKeyDescriptorError(
          'This account was imported from a descriptor containing private ' +
            'key material. Core wallet sync cannot safely convert it to a ' +
            'watch-only descriptor — re-import using the extended public ' +
            'key (xpub/ypub/zpub) instead.'
        )
      }
      return [ext, int]
    }
  } catch (error) {
    if (error instanceof PrivateKeyDescriptorError) {
      throw error
    }
    // fall through to null
  }

  return null
}

async function deleteWalletDb(dbPath: string): Promise<void> {
  try {
    const uri = dbPath.startsWith('/') ? `file://${dbPath}` : dbPath
    const info = await FileSystem.getInfoAsync(uri)
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true })
    }
  } catch {
    // best-effort; if the file is already gone the wallet will be recreated
  }
}

export {
  broadcastTransaction,
  buildPsbt,
  buildTransaction,
  buildTransactionWithRpc,
  deleteWalletDb,
  getDescriptorString,
  getExtendedPublicKeyFromAccountKey,
  getLastUnusedAddressFromWallet,
  getPublicDescriptorsForAccount,
  getTransactionInputValues,
  getWalletData,
  parseDescriptor,
  resolveRpcWalletName,
  signTransaction,
  syncWallet
}
