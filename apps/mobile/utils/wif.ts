import ecc from '@bitcoinerlab/secp256k1'
import bs58check from 'bs58check'

import { type Secret } from '@/types/models/Account'
import { type ScriptVersionType } from '@/types/models/Script'
import { type Network } from '@/types/settings/blockchain'
import { addDescriptorChecksum } from '@/utils/descriptor'

const PRIVATE_KEY_BYTE_LENGTH = 32
const PRIVATE_KEY_HEX_LENGTH = PRIVATE_KEY_BYTE_LENGTH * 2
const WIF_VERSION_MAINNET = 0x80
const WIF_VERSION_TESTNET = 0xef
const WIF_COMPRESSED_FLAG = 0x01
const COMPRESSED_PUBLIC_KEY_PREFIX_LENGTH = 1

const COMPRESSED_WIF_SCRIPT_VERSIONS = ['P2PKH', 'P2WPKH', 'P2TR'] as const
const UNCOMPRESSED_WIF_SCRIPT_VERSIONS = ['P2PKH'] as const

const SINGLE_SIG_SCRIPT_VERSIONS = [
  'P2PKH',
  'P2SH-P2WPKH',
  'P2WPKH',
  'P2TR'
] as const satisfies readonly ScriptVersionType[]

export type WifDecodeFailure = 'invalid' | 'network'

export type WifDecodeResult =
  | { ok: true; privateKeyHex: string; compressed: boolean }
  | { ok: false; reason: WifDecodeFailure }

export type WifScriptLimitReason = 'uncompressed' | 'unsupported'

export type WifScriptLimit = {
  script: ScriptVersionType
  reason: WifScriptLimitReason
}

function decodeWifPayload(wif: string) {
  try {
    return Buffer.from(bs58check.decode(wif))
  } catch {
    return undefined
  }
}

function wifVersion(network: Network) {
  return network === 'bitcoin' ? WIF_VERSION_MAINNET : WIF_VERSION_TESTNET
}

function allowedScriptVersions(compressed: boolean) {
  return compressed
    ? COMPRESSED_WIF_SCRIPT_VERSIONS
    : UNCOMPRESSED_WIF_SCRIPT_VERSIONS
}

export function isScriptVersionAllowedForWif(
  scriptVersion: ScriptVersionType,
  compressed: boolean
) {
  return allowedScriptVersions(compressed).some(
    (allowed) => allowed === scriptVersion
  )
}

export function scriptVersionForWifImport(
  scriptVersion: ScriptVersionType,
  compressed: boolean
): ScriptVersionType {
  if (isScriptVersionAllowedForWif(scriptVersion, compressed)) {
    return scriptVersion
  }
  return 'P2PKH'
}

export function wifScriptLimits(compressed: boolean): WifScriptLimit[] {
  return SINGLE_SIG_SCRIPT_VERSIONS.filter(
    (script) => !isScriptVersionAllowedForWif(script, compressed)
  ).map((script) => ({
    reason: compressed ? 'unsupported' : 'uncompressed',
    script
  }))
}

export function decodeWif(wif: string, network: Network): WifDecodeResult {
  const trimmed = wif.trim()
  if (!trimmed) {
    return { ok: false, reason: 'invalid' }
  }

  const payload = decodeWifPayload(trimmed)
  if (!payload) {
    return { ok: false, reason: 'invalid' }
  }

  const compressed = payload.length === PRIVATE_KEY_BYTE_LENGTH + 2
  const uncompressed = payload.length === PRIVATE_KEY_BYTE_LENGTH + 1
  if (!compressed && !uncompressed) {
    return { ok: false, reason: 'invalid' }
  }
  if (compressed && payload.at(-1) !== WIF_COMPRESSED_FLAG) {
    return { ok: false, reason: 'invalid' }
  }
  if (payload[0] !== wifVersion(network)) {
    return { ok: false, reason: 'network' }
  }

  const privateKey = payload.subarray(1, 1 + PRIVATE_KEY_BYTE_LENGTH)
  if (!ecc.pointFromScalar(privateKey, true)) {
    return { ok: false, reason: 'invalid' }
  }

  return {
    compressed,
    ok: true,
    privateKeyHex: Buffer.from(privateKey).toString('hex')
  }
}

function publicKeyHex(privateKeyHex: string, compressed: boolean) {
  if (privateKeyHex.length !== PRIVATE_KEY_HEX_LENGTH) {
    return
  }
  const privateKey = Buffer.from(privateKeyHex, 'hex')
  const point = ecc.pointFromScalar(privateKey, compressed)
  if (!point) {
    return
  }
  return Buffer.from(point).toString('hex')
}

export function publicDescriptorFromPrivateKey(
  privateKeyHex: string,
  compressed: boolean,
  scriptVersion: ScriptVersionType
) {
  if (!isScriptVersionAllowedForWif(scriptVersion, compressed)) {
    return
  }
  const publicKey = publicKeyHex(privateKeyHex, true)
  if (!publicKey) {
    return
  }

  if (scriptVersion === 'P2TR') {
    const xOnly = publicKey.slice(COMPRESSED_PUBLIC_KEY_PREFIX_LENGTH)
    return addDescriptorChecksum(`tr(${xOnly})`)
  }

  const keyHex = compressed ? publicKey : publicKeyHex(privateKeyHex, false)
  if (!keyHex) {
    return
  }

  if (scriptVersion === 'P2PKH') {
    return addDescriptorChecksum(`pkh(${keyHex})`)
  }

  return addDescriptorChecksum(`wpkh(${keyHex})`)
}

// BDK refuses a wallet whose receive and change descriptors are the same, and
// the SDK substitutes the receive descriptor when change is omitted. A WIF has
// one receive script, so change is a different script of the same key. The
// private form is what BDK extracts keys from; `wallet.sign` cannot sign a
// public-only descriptor.
export function walletDescriptorsFromPrivateKey(
  privateKeyHex: string,
  compressed: boolean,
  scriptVersion: ScriptVersionType,
  network: Network
) {
  if (!isScriptVersionAllowedForWif(scriptVersion, compressed)) {
    return
  }
  const wif = encodeWif(privateKeyHex, network, compressed)
  if (!wif) {
    return
  }
  const receive = privateDescriptorBody(scriptVersion, wif)
  const change = companionPrivateDescriptor(scriptVersion, compressed, wif)
  if (!receive || !change) {
    return
  }
  return {
    change: addDescriptorChecksum(change),
    receive: addDescriptorChecksum(receive)
  }
}

function privateDescriptorBody(scriptVersion: ScriptVersionType, wif: string) {
  if (scriptVersion === 'P2PKH') {
    return `pkh(${wif})`
  }
  if (scriptVersion === 'P2WPKH') {
    return `wpkh(${wif})`
  }
  if (scriptVersion === 'P2TR') {
    return `tr(${wif})`
  }
}

function companionPrivateDescriptor(
  scriptVersion: ScriptVersionType,
  compressed: boolean,
  wif: string
) {
  if (scriptVersion === 'P2PKH' && !compressed) {
    return `sh(pkh(${wif}))`
  }
  if (scriptVersion === 'P2PKH') {
    return `wpkh(${wif})`
  }
  return `pkh(${wif})`
}

export function wifImportSecret(
  decoded: Extract<WifDecodeResult, { ok: true }>,
  scriptVersion: ScriptVersionType
): Secret | undefined {
  const externalDescriptor = publicDescriptorFromPrivateKey(
    decoded.privateKeyHex,
    decoded.compressed,
    scriptVersion
  )
  if (!externalDescriptor) {
    return
  }
  return {
    externalDescriptor,
    privateKey: decoded.privateKeyHex,
    privateKeyCompressed: decoded.compressed
  }
}

export function encodeWif(
  privateKeyHex: string,
  network: Network,
  compressed: boolean
) {
  const privateKey = Buffer.from(privateKeyHex, 'hex')
  if (privateKey.length !== PRIVATE_KEY_BYTE_LENGTH) {
    return
  }
  const payload = compressed
    ? Buffer.concat([
        Buffer.from([wifVersion(network)]),
        privateKey,
        Buffer.from([WIF_COMPRESSED_FLAG])
      ])
    : Buffer.concat([Buffer.from([wifVersion(network)]), privateKey])
  return bs58check.encode(payload)
}

export function wifFromStoredSecret(secret: Secret, network: Network) {
  if (!secret.privateKey || secret.privateKeyCompressed === undefined) {
    return
  }
  return encodeWif(secret.privateKey, network, secret.privateKeyCompressed)
}
