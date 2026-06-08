import {
  BRANTA_ID_PARAM,
  BRANTA_SECRET_PARAM
} from '@/constants/branta'
import { type BrantaTriggerMode } from '@/types/models/Branta'

function hasBrantaZkQueryParams(content: string): boolean {
  const queryIndex = content.indexOf('?')
  if (queryIndex === -1) {
    return false
  }

  const params = new URLSearchParams(content.slice(queryIndex + 1))
  return (
    params.has(BRANTA_ID_PARAM) && params.has(BRANTA_SECRET_PARAM)
  )
}

function isBrantaVerificationEnabled(mode: BrantaTriggerMode): boolean {
  return mode !== 'off'
}

function shouldAutoVerify(mode: BrantaTriggerMode): boolean {
  return mode === 'auto'
}

function shouldShowVerifyButton(mode: BrantaTriggerMode): boolean {
  return mode === 'on_request'
}

function shouldAutoPrefetchLogo(mode: BrantaTriggerMode): boolean {
  return mode === 'auto'
}

function shouldShowLogoPrefetchButton(mode: BrantaTriggerMode): boolean {
  return mode === 'on_request'
}

function normalizeBrantaRawContent(content: string): string {
  return content.trim()
}

function isBrantaLookupContent(content: string): boolean {
  const trimmed = normalizeBrantaRawContent(content)
  if (!trimmed) {
    return false
  }

  if (hasBrantaZkQueryParams(trimmed)) {
    return true
  }

  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('lnbc') ||
    lower.startsWith('lno') ||
    lower.startsWith('lnurl') ||
    lower.startsWith('lightning:') ||
    lower.startsWith('bitcoin:') ||
    lower.startsWith('ark1')
  ) {
    return true
  }

  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return true
  }

  if (
    trimmed.startsWith('1') ||
    trimmed.startsWith('3') ||
    lower.startsWith('bc1')
  ) {
    return true
  }

  return false
}

export {
  hasBrantaZkQueryParams,
  isBrantaLookupContent,
  isBrantaVerificationEnabled,
  normalizeBrantaRawContent,
  shouldAutoPrefetchLogo,
  shouldAutoVerify,
  shouldShowLogoPrefetchButton,
  shouldShowVerifyButton
}
