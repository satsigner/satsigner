import { Buffer } from 'buffer'

import * as DocumentPicker from 'expo-document-picker'
import NDK from '@nostr-dev-kit/ndk'
import type { NDKEvent } from '@nostr-dev-kit/ndk'

export type BlobDescriptor = {
  url: string
  sha256: string
  size: number
  type?: string
  uploaded: number
  name?: string
}

const NIP94_FILE_KIND = 1063
const NOSTR_FILES_FETCH_TIMEOUT_MS = 8000

export async function listBlossomFiles(
  serverUrl: string,
  pubkeyHex: string
): Promise<BlobDescriptor[]> {
  const url = `${serverUrl.replace(/\/$/, '')}/list/${pubkeyHex}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to list files (HTTP ${response.status})`)
  }
  return response.json() as Promise<BlobDescriptor[]>
}

function ndkEventToBlobDescriptor(event: NDKEvent): BlobDescriptor | null {
  const tagMap = Object.fromEntries(event.tags.map(([k, v]) => [k, v ?? '']))
  const url = tagMap['url']
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

export function fetchNostrFileEvents(
  pubkeyHex: string,
  relays: string[]
): Promise<BlobDescriptor[]> {
  const ndk = new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls: relays
  })
  ndk.connect()

  return new Promise((resolve) => {
    const results: BlobDescriptor[] = []
    let settled = false

    const sub = ndk.subscribe(
      { authors: [pubkeyHex], kinds: [NIP94_FILE_KIND] },
      { closeOnEose: false }
    )

    const finish = () => {
      if (settled) {
        return
      }
      settled = true
      sub.stop()
      resolve(results)
    }

    sub.on('event', (event: NDKEvent) => {
      const blob = ndkEventToBlobDescriptor(event)
      if (blob) {
        results.push(blob)
      }
    })

    sub.on('eose', () => {
      if (ndk.pool.connectedRelays().length > 0) {
        finish()
      }
    })

    setTimeout(finish, NOSTR_FILES_FETCH_TIMEOUT_MS)
  })
}
import * as FileSystem from 'expo-file-system/legacy'
import { finalizeEvent } from 'nostr-tools'
import QuickCrypto from 'react-native-quick-crypto'

import { getSecretFromNsec } from '@/utils/nostr'

const BLOSSOM_AUTH_KIND = 24242
const BLOSSOM_AUTH_EXPIRY_SECS = 300

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
  const asset = result.assets[0]
  return {
    mimeType: asset.mimeType ?? 'application/octet-stream',
    uri: asset.uri
  }
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
