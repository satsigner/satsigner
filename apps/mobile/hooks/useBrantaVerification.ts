import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { verifyBrantaContent } from '@/api/branta'
import { useBrantaSettingsStore } from '@/store/brantaSettings'
import {
  type BrantaTorStatus,
  type BrantaVerificationResult
} from '@/types/models/Branta'
import {
  isBrantaLookupContent,
  isBrantaVerificationEnabled,
  normalizeBrantaRawContent,
  shouldAutoPrefetchLogo,
  shouldAutoVerify,
  shouldShowVerifyButton
} from '@/utils/branta'
import {
  askBrantaClearnetConsent,
  askBrantaImageLoadConsent
} from '@/utils/brantaClearnetConsent'
import { resolveTorProxyForBranta } from '@/utils/torProxy'

type UseBrantaVerificationOptions = {
  rawContent: string
  isQrSource?: boolean
}

type UseBrantaVerificationResult = {
  enabled: boolean
  showVerifyButton: boolean
  showClearnetVerifyButton: boolean
  showLoadLogoButton: boolean
  isVerifying: boolean
  isLoadingLogo: boolean
  verification: BrantaVerificationResult | null
  verificationAttempted: boolean
  verificationError: Error | null
  normalizedContent: string
  logoUrl: string | null
  logoLoaded: boolean
  torStatus: BrantaTorStatus
  verify: () => Promise<void>
  verifyOnClearnet: () => Promise<void>
  loadLogo: () => Promise<void>
}

function getLogoUrl(
  verification: BrantaVerificationResult | null
): string | null {
  const payment = verification?.payments[0]
  if (!payment) {
    return null
  }
  return payment.platformLogoUrl ?? payment.platformLogoLightUrl ?? null
}

function resolveTorStatus(
  enabled: boolean,
  isFetching: boolean,
  data: unknown
): BrantaTorStatus {
  if (!enabled) {
    return 'unavailable'
  }
  if (isFetching) {
    return 'checking'
  }
  if (data) {
    return 'available'
  }
  if (data === null) {
    return 'unavailable'
  }
  return 'checking'
}

function useBrantaVerification({
  rawContent,
  isQrSource = false
}: UseBrantaVerificationOptions): UseBrantaVerificationResult {
  const [verificationMode, logoPrefetchMode] = useBrantaSettingsStore(
    useShallow((state) => [state.verificationMode, state.logoPrefetchMode])
  )

  // Track logo consent per-content so it resets automatically when the address changes
  const [logoState, setLogoState] = useState<{ content: string } | null>(null)

  const normalizedContent = normalizeBrantaRawContent(rawContent)
  const enabled =
    isBrantaVerificationEnabled(verificationMode) &&
    isBrantaLookupContent(normalizedContent)

  const torProbeQuery = useQuery({
    enabled,
    gcTime: 60_000,
    queryFn: resolveTorProxyForBranta,
    queryKey: ['branta-tor-probe'],
    retry: false,
    staleTime: 30_000
  })

  const torStatus = resolveTorStatus(
    enabled,
    torProbeQuery.isFetching,
    torProbeQuery.data
  )

  // Runs automatically when mode is 'auto' and Tor is reachable.
  // queryKey includes content so results reset when the address changes.
  const autoVerifyQuery = useQuery({
    enabled:
      enabled &&
      shouldAutoVerify(verificationMode) &&
      torStatus === 'available',
    gcTime: 0,
    queryFn: () => verifyBrantaContent(normalizedContent, isQrSource, 'tor'),
    queryKey: ['branta-auto-verify', normalizedContent, isQrSource],
    retry: false,
    staleTime: Infinity
  })

  // Disabled by default — triggered via refetch() when user taps "Verify via Tor".
  const torVerifyQuery = useQuery({
    enabled: false,
    gcTime: 0,
    queryFn: () => verifyBrantaContent(normalizedContent, isQrSource, 'tor'),
    queryKey: ['branta-tor-verify', normalizedContent, isQrSource],
    retry: false,
    staleTime: Infinity
  })

  // Disabled by default — triggered via refetch() after clearnet consent.
  const clearnetVerifyQuery = useQuery({
    enabled: false,
    gcTime: 0,
    queryFn: () =>
      verifyBrantaContent(normalizedContent, isQrSource, 'clearnet'),
    queryKey: ['branta-clearnet-verify', normalizedContent, isQrSource],
    retry: false,
    staleTime: Infinity
  })

  const verification =
    autoVerifyQuery.data ??
    torVerifyQuery.data ??
    clearnetVerifyQuery.data ??
    null

  const isVerifying =
    autoVerifyQuery.isFetching ||
    torVerifyQuery.isFetching ||
    clearnetVerifyQuery.isFetching

  const logoUrl = getLogoUrl(verification)
  const logoManuallyLoaded = logoState?.content === normalizedContent
  const logoLoaded = shouldAutoPrefetchLogo(logoPrefetchMode)
    ? Boolean(logoUrl && verification)
    : logoManuallyLoaded

  const verificationAttempted =
    autoVerifyQuery.isFetched ||
    torVerifyQuery.isFetched ||
    clearnetVerifyQuery.isFetched

  const verificationError =
    (autoVerifyQuery.error as Error | null) ??
    (torVerifyQuery.error as Error | null) ??
    (clearnetVerifyQuery.error as Error | null) ??
    null

  const hasMatch = Boolean(verification?.payments.length)

  const showVerifyButton =
    enabled &&
    shouldShowVerifyButton(verificationMode) &&
    torStatus === 'available' &&
    !hasMatch

  const showClearnetVerifyButton =
    enabled &&
    torStatus === 'unavailable' &&
    (shouldShowVerifyButton(verificationMode) ||
      shouldAutoVerify(verificationMode))

  const showLoadLogoButton = Boolean(enabled && logoUrl && !logoLoaded)

  async function verify() {
    await torVerifyQuery.refetch()
  }

  async function verifyOnClearnet() {
    const confirmed = await askBrantaClearnetConsent()
    if (confirmed) {
      await clearnetVerifyQuery.refetch()
    }
  }

  async function loadLogo() {
    if (!logoUrl || logoManuallyLoaded) {
      return
    }
    const confirmed = await askBrantaImageLoadConsent(logoUrl)
    if (confirmed) {
      setLogoState({ content: normalizedContent })
    }
  }

  if (__DEV__) {
    console.log(
      '[Branta] enabled:',
      enabled,
      'mode:',
      verificationMode,
      'content:',
      normalizedContent.slice(0, 50)
    )
    console.log('[Branta] torStatus:', torStatus, 'isVerifying:', isVerifying)
    console.log(
      '[Branta] autoVerify — fetching:',
      autoVerifyQuery.isFetching,
      'fetched:',
      autoVerifyQuery.isFetched,
      'payments:',
      autoVerifyQuery.data?.payments.length ?? 'n/a',
      'error:',
      autoVerifyQuery.error?.message ?? 'none'
    )
    console.log(
      '[Branta] torVerify  — fetching:',
      torVerifyQuery.isFetching,
      'fetched:',
      torVerifyQuery.isFetched,
      'payments:',
      torVerifyQuery.data?.payments.length ?? 'n/a',
      'error:',
      torVerifyQuery.error?.message ?? 'none'
    )
    console.log(
      '[Branta] clearnet   — fetching:',
      clearnetVerifyQuery.isFetching,
      'fetched:',
      clearnetVerifyQuery.isFetched,
      'payments:',
      clearnetVerifyQuery.data?.payments.length ?? 'n/a',
      'error:',
      clearnetVerifyQuery.error?.message ?? 'none'
    )
    console.log(
      '[Branta] verificationAttempted:',
      verificationAttempted,
      'hasMatch:',
      hasMatch,
      'error:',
      verificationError?.message ?? 'none'
    )
  }

  return {
    enabled,
    isLoadingLogo: false,
    isVerifying,
    loadLogo,
    logoLoaded,
    logoUrl,
    normalizedContent,
    showClearnetVerifyButton,
    showLoadLogoButton,
    showVerifyButton,
    torStatus,
    verification,
    verificationAttempted,
    verificationError,
    verify,
    verifyOnClearnet
  }
}

export { useBrantaVerification }
