import {
  fetchKind10063Servers,
  listBlossomFiles,
  type BlobDescriptor
} from '@/api/blossom'
import { NostrAPI } from '@/api/nostr'
import { NOSTR_BLOSSOM_FILE_DISPLAY_HASH_LENGTH } from '@/constants/nostr'
import { t } from '@/locales'
import {
  type BlossomFileCategory,
  type BlossomFileTypeFilter
} from '@/types/models/Blossom'

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const
const BYTES_PER_KIB = 1024

export const BLOSSOM_FILE_TYPE_FILTERS: BlossomFileCategory[] = [
  'image',
  'video',
  'audio',
  'document',
  'other'
]

type BlossomFileDetailItem = [
  string,
  string | number | undefined,
  { copyToClipboard?: boolean }?
]

export function formatBlossomFileSize(bytes: number): string {
  const maxUnitIndex = FILE_SIZE_UNITS.length - 1
  const scaled = Array.from({ length: maxUnitIndex + 1 }, (_, unitIndex) => ({
    unitIndex,
    value: bytes / BYTES_PER_KIB ** unitIndex
  }))
  const selected =
    scaled.find((entry) => entry.value < BYTES_PER_KIB) ?? scaled[maxUnitIndex]
  const rounded =
    selected.unitIndex === 0
      ? selected.value
      : Math.round(selected.value * 10) / 10

  return `${rounded} ${FILE_SIZE_UNITS[selected.unitIndex]}`
}

export function formatBlossomUploadDate(unixTs: number): string {
  const date = new Date(unixTs * 1000)
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export function formatBlossomUploadDateTime(unixTs: number): string {
  const date = new Date(unixTs * 1000)
  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function mimeToFileCategory(mime?: string): BlossomFileCategory {
  if (!mime) {
    return 'other'
  }
  if (mime.startsWith('image/')) {
    return 'image'
  }
  if (mime.startsWith('video/')) {
    return 'video'
  }
  if (mime.startsWith('audio/')) {
    return 'audio'
  }
  if (mime.startsWith('text/') || mime === 'application/pdf') {
    return 'document'
  }
  return 'other'
}

export function isBlossomImageMime(mime?: string): boolean {
  return mime?.startsWith('image/') === true
}

export function getBlossomFileCategoryLabel(
  category: BlossomFileCategory
): string {
  return t(`nostrIdentity.files.category.${category}`)
}

export function getBlossomFileTypeFilterLabel(
  filter: BlossomFileTypeFilter
): string {
  if (filter === 'all') {
    return t('nostrIdentity.files.filter.all')
  }

  return getBlossomFileCategoryLabel(filter)
}

export function getBlossomFileDisplayName(file: BlobDescriptor): string {
  return (
    file.name ??
    file.url.split('/').pop() ??
    file.sha256.slice(0, NOSTR_BLOSSOM_FILE_DISPLAY_HASH_LENGTH)
  )
}

export function getBlossomFileExtension(file: BlobDescriptor): string {
  const filename = getBlossomFileDisplayName(file)
  return filename.split('.').pop()?.toUpperCase() ?? ''
}

export function getAvailableBlossomFileFilters(
  files: BlobDescriptor[]
): BlossomFileTypeFilter[] {
  const filters: BlossomFileTypeFilter[] = ['all']
  const categoryCounts: Partial<Record<BlossomFileCategory, number>> = {}

  for (const file of files) {
    const category = mimeToFileCategory(file.type)
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1
  }

  for (const category of BLOSSOM_FILE_TYPE_FILTERS) {
    if (categoryCounts[category]) {
      filters.push(category)
    }
  }

  return filters
}

export function filterBlossomFilesByType(
  files: BlobDescriptor[],
  filter: BlossomFileTypeFilter
): BlobDescriptor[] {
  if (filter === 'all') {
    return files
  }

  return files.filter((file) => mimeToFileCategory(file.type) === filter)
}

export function findBlossomFileBySha256(
  files: BlobDescriptor[],
  sha256: string
): BlobDescriptor | undefined {
  return files.find((file) => file.sha256 === sha256)
}

export function buildBlossomFileDetailItems(
  file: BlobDescriptor
): BlossomFileDetailItem[] {
  return [
    [
      t('nostrIdentity.files.detail.name'),
      file.name ?? '-',
      { copyToClipboard: !!file.name }
    ],
    [
      t('nostrIdentity.files.detail.extension'),
      getBlossomFileExtension(file) || '-'
    ],
    [
      t('nostrIdentity.files.detail.category'),
      getBlossomFileCategoryLabel(mimeToFileCategory(file.type))
    ],
    [
      t('nostrIdentity.files.detail.mime'),
      file.type ?? '-',
      { copyToClipboard: !!file.type }
    ],
    [t('nostrIdentity.files.detail.size'), formatBlossomFileSize(file.size)],
    [
      t('nostrIdentity.files.detail.uploaded'),
      file.uploaded ? formatBlossomUploadDateTime(file.uploaded) : '-'
    ],
    [t('nostrIdentity.files.detail.sha256'), file.sha256],
    [t('nostrIdentity.files.detail.url'), file.url]
  ]
}

export function deduplicateBlossomFilesBySha256(
  blobs: BlobDescriptor[]
): BlobDescriptor[] {
  const seen = new Set<string>()
  return blobs.filter((blob) => {
    if (seen.has(blob.sha256)) {
      return false
    }
    seen.add(blob.sha256)
    return true
  })
}

export async function fetchAllBlossomFiles(
  servers: string[],
  pubkeyHex: string,
  nsec?: string
): Promise<BlobDescriptor[]> {
  const results = await Promise.allSettled(
    servers.map((url) => listBlossomFiles(url, pubkeyHex, nsec))
  )
  const blobs = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )
  return deduplicateBlossomFilesBySha256(blobs)
}

export function blossomFilesQueryKey(pubkeyHex: string, servers: string[]) {
  return ['blossom', 'files', pubkeyHex, servers.join(',')] as const
}

export function resolveBlossomServers(
  pubkeyHex: string,
  configuredServers: string[],
  relays: string[]
): Promise<string[]> {
  if (configuredServers.length > 0) {
    return Promise.resolve(configuredServers)
  }

  return fetchKind10063Servers(pubkeyHex, relays)
}

export function getBlossomRelays(
  identityRelays: string[] | undefined,
  globalRelays: string[]
): string[] {
  if (identityRelays?.length) {
    return identityRelays
  }

  if (globalRelays.length > 0) {
    return globalRelays
  }

  return NostrAPI.INDEXING_RELAYS
}
