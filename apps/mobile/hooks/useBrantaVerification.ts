import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function useBrantaVerification({
  rawContent,
  isQrSource = false
}: UseBrantaVerificationOptions): UseBrantaVerificationResult {
  const [verificationMode, logoPrefetchMode] = useBrantaSettingsStore(
    useShallow((state) => [state.verificationMode, state.logoPrefetchMode])
  )

  const [verification, setVerification] =
    useState<BrantaVerificationResult | null>(null)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isLoadingLogo, setIsLoadingLogo] = useState(false)
  const [torStatus, setTorStatus] = useState<BrantaTorStatus>('checking')
  const verifyRequestIdRef = useRef(0)

  const normalizedContent = normalizeBrantaRawContent(rawContent)
  const logoUrl = useMemo(() => getLogoUrl(verification), [verification])

  const enabled =
    isBrantaVerificationEnabled(verificationMode) &&
    isBrantaLookupContent(normalizedContent)
  const showVerifyButton =
    enabled &&
    shouldShowVerifyButton(verificationMode) &&
    torStatus === 'available'
  const showClearnetVerifyButton =
    enabled &&
    torStatus === 'unavailable' &&
    (shouldShowVerifyButton(verificationMode) ||
      shouldAutoVerify(verificationMode))
  const showLoadLogoButton = Boolean(
    enabled && logoUrl && !logoLoaded
  )

  useEffect(() => {
    let cancelled = false

    async function checkTor() {
      setTorStatus('checking')
      const proxy = await resolveTorProxyForBranta()
      if (!cancelled) {
        setTorStatus(proxy ? 'available' : 'unavailable')
      }
    }

    if (enabled) {
      void checkTor()
    } else {
      setTorStatus('unavailable')
    }

    return () => {
      cancelled = true
    }
  }, [enabled, normalizedContent])

  const runVerification = useCallback(
    async (route: 'tor' | 'clearnet') => {
      if (!enabled || !normalizedContent) {
        setVerification(null)
        setLogoLoaded(false)
        return
      }

      if (route === 'clearnet') {
        const confirmed = await askBrantaClearnetConsent()
        if (!confirmed) {
          return
        }
      }

      const requestId = verifyRequestIdRef.current + 1
      verifyRequestIdRef.current = requestId
      setIsVerifying(true)

      try {
        const result = await verifyBrantaContent(
          normalizedContent,
          isQrSource,
          route
        )
        if (verifyRequestIdRef.current !== requestId) {
          return
        }

        setVerification(result)
        setLogoLoaded(
          Boolean(
            result &&
              shouldAutoPrefetchLogo(logoPrefetchMode) &&
              getLogoUrl(result)
          )
        )
      } finally {
        if (verifyRequestIdRef.current === requestId) {
          setIsVerifying(false)
        }
      }
    },
    [enabled, isQrSource, logoPrefetchMode, normalizedContent]
  )

  useEffect(() => {
    setVerification(null)
    setLogoLoaded(false)

    if (!enabled || torStatus !== 'available') {
      return
    }

    if (shouldAutoVerify(verificationMode)) {
      void runVerification('tor')
    }
  }, [
    enabled,
    normalizedContent,
    runVerification,
    torStatus,
    verificationMode
  ])

  const verify = useCallback(async () => {
    await runVerification('tor')
  }, [runVerification])

  const verifyOnClearnet = useCallback(async () => {
    await runVerification('clearnet')
  }, [runVerification])

  const loadLogo = useCallback(async () => {
    if (!logoUrl || logoLoaded) {
      return
    }

    const confirmed = await askBrantaImageLoadConsent(logoUrl)
    if (!confirmed) {
      return
    }

    setIsLoadingLogo(true)
    setLogoLoaded(true)
    setIsLoadingLogo(false)
  }, [logoLoaded, logoUrl])

  useEffect(() => {
    if (
      verification &&
      shouldAutoPrefetchLogo(logoPrefetchMode) &&
      logoUrl &&
      !logoLoaded
    ) {
      setLogoLoaded(true)
    }
  }, [logoLoaded, logoPrefetchMode, logoUrl, verification])

  return {
    enabled,
    isLoadingLogo,
    isVerifying,
    loadLogo,
    logoLoaded,
    logoUrl,
    showClearnetVerifyButton,
    showLoadLogoButton,
    showVerifyButton,
    torStatus,
    verification,
    verify,
    verifyOnClearnet
  }
}

export { useBrantaVerification }
