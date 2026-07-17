import { Buffer } from 'buffer'

import NDK from '@nostr-dev-kit/ndk'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { finalizeEvent } from 'nostr-tools'
import QuickCrypto from 'react-native-quick-crypto'

import { getSecretFromNsec } from '@/utils/nostr'

export type BlobDescriptor = {
  url: string
  sha256: string
  size: number
  type?: string
  uploaded: number
  name?: string
}

const NIP94_FILE_KIND = 1063
const BLOSSOM_SERVER_LIST_KIND = 10063
const NOSTR_FILES_FETCH_TIMEOUT_MS = 8000
const BLOSSOM_AUTH_KIND = 24242
const BLOSSOM_AUTH_EXPIRY_SECS = 300

async function parseBlossomList(response: Response): Promise<BlobDescriptor[]> {
  if (response.status === 401 || response.status === 404) {
    return []
  }
  if (!response.ok) {
    throw new Error(`Failed to list files (HTTP ${response.status})`)
  }
  const text = await response.text()
  try {
    const parsed = JSON.parse(text) as unknown
    return Array.isArray(parsed) ? (parsed as BlobDescriptor[]) : []
  } catch {
    return []
  }
}

export async function listBlossomFiles(
  serverUrl: string,
  pubkeyHex: string,
  nsec?: string
): Promise<BlobDescriptor[]> {
  const base = serverUrl.replace(/\/$/, '')
  const url = `${base}/list/${pubkeyHex}`
  const response = await fetch(url)
  if (response.status === 401 && nsec) {
    const secretKey = getSecretFromNsec(nsec)
    if (secretKey) {
      const authHeader = buildListAuthHeader(secretKey, base)
      const retryResponse = await fetch(url, {
        headers: { Authorization: authHeader }
      })
      return parseBlossomList(retryResponse)
    }
  }
  return parseBlossomList(response)
}

function ndkEventToBlobDescriptor(event: NDKEvent): BlobDescriptor | null {
  const tagMap = Object.fromEntries(event.tags.map(([k, v]) => [k, v ?? '']))
  const { url } = tagMap
  const sha256 = tagMap['x']
  if (!url || !sha256) {
    return null
  }
  return {
    name: tagMap['name'] || undefined,
    sha256,
    size: Number(tagMap['size'] ?? 0),
    type: tagMap['m'] || undefined,
    uploaded: event.created_at ?? 0,
    url
  }
}

function disconnectNdkPool(ndk: NDK): void {
  try {
    for (const relay of ndk.pool?.relays.values() ?? []) {
      relay.disconnect()
    }
  } catch {
    // best-effort cleanup
  }
}

function subscribeOnce(
  ndk: NDK,
  filter: Parameters<NDK['subscribe']>[0],
  onEvent: (event: NDKEvent) => void,
  timeoutMs: number
): Promise<void> {
  ndk.connect()
  return new Promise((resolve) => {
    let settled = false

    const sub = ndk.subscribe(filter, { closeOnEose: false })

    const finish = () => {
      if (settled) {
        return
      }
      settled = true
      sub.stop()
      disconnectNdkPool(ndk)
      resolve()
    }

    sub.on('event', (event: NDKEvent) => {
      onEvent(event)
    })
    sub.on('eose', () => {
      if (ndk.pool.connectedRelays().length > 0) {
        finish()
      }
    })
    setTimeout(finish, timeoutMs)
  })
}

export async function fetchNostrFileEvents(
  pubkeyHex: string,
  relays: string[]
): Promise<BlobDescriptor[]> {
  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })
  const results: BlobDescriptor[] = []
  await subscribeOnce(
    ndk,
    { authors: [pubkeyHex], kinds: [NIP94_FILE_KIND] },
    (event) => {
      const blob = ndkEventToBlobDescriptor(event)
      if (blob) {
        results.push(blob)
      }
    },
    NOSTR_FILES_FETCH_TIMEOUT_MS
  )
  return results
}

export async function fetchKind10063Servers(
  pubkeyHex: string,
  relays: string[]
): Promise<string[]> {
  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })
  const servers: string[] = []
  await subscribeOnce(
    ndk,
    { authors: [pubkeyHex], kinds: [BLOSSOM_SERVER_LIST_KIND], limit: 1 },
    (event) => {
      for (const tag of event.tags) {
        if (tag[0] === 'server' && tag[1]) {
          servers.push(tag[1])
        }
      }
    },
    NOSTR_FILES_FETCH_TIMEOUT_MS
  )
  return [...new Set(servers)]
}

type UploadParams = {
  fileUri: string
  mimeType: string
  nsec: string
  serverUrl: string
}

export async function pickImageForUpload(): Promise<{
  uri: string
  mimeType: string
} | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' })
  if (result.canceled || !result.assets?.[0]) {
    return null
  }
  const [asset] = result.assets
  return {
    mimeType: asset.mimeType ?? 'application/octet-stream',
    uri: asset.uri
  }
}

function buildListAuthHeader(secretKey: Uint8Array, serverUrl: string): string {
  const now = Math.floor(Date.now() / 1000)
  const authEvent = finalizeEvent(
    {
      content: 'List blobs',
      created_at: now,
      kind: BLOSSOM_AUTH_KIND,
      tags: [
        ['t', 'list'],
        ['server', serverUrl],
        ['expiration', String(now + BLOSSOM_AUTH_EXPIRY_SECS)]
      ]
    },
    secretKey
  )
  return `Nostr ${Buffer.from(JSON.stringify(authEvent)).toString('base64')}`
}

function buildAuthHeader(payloadHash: string, secretKey: Uint8Array): string {
  const now = Math.floor(Date.now() / 1000)
  const authEvent = finalizeEvent(
    {
      content: 'Upload image',
      created_at: now,
      kind: BLOSSOM_AUTH_KIND,
      tags: [
        ['t', 'upload'],
        ['expiration', String(now + BLOSSOM_AUTH_EXPIRY_SECS)],
        ['x', payloadHash]
      ]
    },
    secretKey
  )
  return `Nostr ${Buffer.from(JSON.stringify(authEvent)).toString('base64')}`
}

function putBinary(
  url: string,
  data: ArrayBuffer,
  mimeType: string,
  authHeader: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Authorization', authHeader)
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText)
      } else {
        reject(
          new Error(
            `Server rejected upload (HTTP ${xhr.status}): ${xhr.responseText.slice(0, 200)}`
          )
        )
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.send(data)
  })
}

export async function uploadToBlossom(params: UploadParams): Promise<string> {
  const { fileUri, mimeType, nsec, serverUrl } = params

  const secretKey = getSecretFromNsec(nsec)
  if (!secretKey) {
    throw new Error('Could not read private key from nsec')
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64
  })
  const fileBytes = Buffer.from(base64, 'base64')

  const payloadHash = QuickCrypto.createHash('sha256')
    .update(fileBytes)
    .digest('hex') as string

  const uploadUrl = `${serverUrl.replace(/\/$/, '')}/upload`
  const authHeader = buildAuthHeader(payloadHash, secretKey)

  // Use XHR to send raw binary — React Native fetch does not reliably
  // transmit Buffer/Uint8Array as a binary body
  const arrayBuffer = new Uint8Array(fileBytes).buffer
  const responseText = await putBinary(
    uploadUrl,
    arrayBuffer,
    mimeType,
    authHeader
  )

  let data: { url?: string }
  try {
    data = JSON.parse(responseText) as { url?: string }
  } catch {
    throw new Error('Blossom server returned invalid JSON')
  }

  if (!data.url) {
    throw new Error('Blossom server response missing URL field')
  }

  return data.url
}
