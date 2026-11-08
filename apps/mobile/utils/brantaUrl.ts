import { BRANTA_HTTPS_HOSTS } from '@/constants/branta'
import { type BrantaLookupMode } from '@/types/models/Branta'

const BRANTA_HOSTS = new Set<string>(BRANTA_HTTPS_HOSTS)

type BrantaLookupSettings = {
  brantaLookupMode: BrantaLookupMode
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

function brantaHttpsUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? ''
  const url = trimmed ? parseUrl(trimmed) : undefined
  if (!url) {
    return undefined
  }

  if (url.protocol !== 'https:') {
    return undefined
  }
  if (url.username || url.password || url.port) {
    return undefined
  }
  if (!BRANTA_HOSTS.has(url.hostname)) {
    return undefined
  }
  return url.toString()
}

/** Off means never contact Branta, so stored payees stop loading logos too. */
function brantaRequestsBlocked({
  brantaLookupMode
}: BrantaLookupSettings): boolean {
  return brantaLookupMode === 'off'
}

function brantaLogoUrl(
  value: string | undefined,
  requestsBlocked: boolean
): string | undefined {
  if (requestsBlocked) {
    return undefined
  }
  return brantaHttpsUrl(value)
}

export { brantaHttpsUrl, brantaLogoUrl, brantaRequestsBlocked }
