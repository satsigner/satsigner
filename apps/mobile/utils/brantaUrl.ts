import { BRANTA_HTTPS_HOSTS } from '@/constants/branta'

const BRANTA_HOSTS = new Set<string>(BRANTA_HTTPS_HOSTS)

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
  if (url.username || url.password) {
    return undefined
  }
  if (!BRANTA_HOSTS.has(url.hostname)) {
    return undefined
  }
  return url.toString()
}

function brantaLogoUrl(
  value: string | undefined,
  torEnabled: boolean
): string | undefined {
  if (torEnabled) {
    return undefined
  }
  return brantaHttpsUrl(value)
}

export { brantaHttpsUrl, brantaLogoUrl }
