import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSContactProfileQrOverlay from '@/components/SSContactProfileQrOverlay'
import SSNostrFeedTabs from '@/components/SSNostrFeedTabs'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaymentMethodPicker from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { useNostrContactProfile } from '@/hooks/useNostrContactProfile'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors, Layout } from '@/styles'
import { type ZapReceiptInfo } from '@/types/models/Nostr'
import { type PaymentMethod } from '@/types/models/PaymentMethod'
import { getPubKeyHexFromNpub, validateNip05 } from '@/utils/nostr'
import {
  buildContactIdentity,
  encodeContactNprofile,
  getContactShareProfileName
} from '@/utils/nostrContactProfile'
import {
  nostrAuthorProfileHref,
  nostrZapDetailHref
} from '@/utils/nostrNavigation'
import { initiateZap } from '@/utils/nostrZap'
import { buildPaymentMethods } from '@/utils/paymentMethods'

type ContactParams = {
  npub: string
  targetNpub: string
}

export default function NostrContactProfile() {
  const router = useRouter()
  const { npub, targetNpub } = useLocalSearchParams<ContactParams>()

  const targetPubkeyHex = getPubKeyHexFromNpub(targetNpub ?? '')

  const owner = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = owner?.relays ?? globalRelays

  const [openedAt] = useState(Date.now)
  const relayConnected = owner?.relayConnected === true
  const { data: contactProfile, isLoading: isProfileLoading } =
    useNostrContactProfile(targetNpub, effectiveRelays, relayConnected)
  const targetIdentity = buildContactIdentity(
    targetNpub,
    contactProfile,
    openedAt
  )

  const nip05 = targetIdentity.nip05?.trim()
  const { data: nip05Valid } = useQuery({
    enabled: !!targetPubkeyHex && !!nip05,
    queryFn: () => validateNip05(targetPubkeyHex!, nip05!),
    queryKey: ['nostr', 'nip05-valid', targetNpub, nip05],
    staleTime: 5 * 60_000
  })
  const [zapLoading, setZapLoading] = useState(false)
  const [qrOverlayVisible, setQrOverlayVisible] = useState(false)
  const [qrOverlayKey, setQrOverlayKey] = useState(0)
  const paymentSheetRef = useRef<BottomSheetMethods>(null)
  const [payAmount, setPayAmount] = useState(0)

  const lightningConfig = useLightningStore((state) => state.config)
  const lightningNodeAlias = useLightningStore(
    (state) => state.status?.nodeInfo?.alias
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)
  const ecashAccounts = useEcashStore((state) => state.accounts)
  const ecashAllMints = useEcashStore((state) => state.mints)
  const setEcashActiveAccountId = useEcashStore(
    (state) => state.setActiveAccountId
  )
  const arkAccounts = useArkStore((state) => state.accounts)

  const pendingInvoice = useState<{
    invoice: string
    zapRequestJson: string
  } | null>(null)

  const availablePaymentMethods = buildPaymentMethods(
    lightningConfig ? { ...lightningConfig, alias: lightningNodeAlias } : null,
    ecashAccounts,
    ecashAllMints,
    arkAccounts
  )

  const showZapButton = Boolean(
    targetIdentity.lud16 && availablePaymentMethods.length > 0 && owner?.nsec
  )

  const contactNprofile = targetPubkeyHex
    ? encodeContactNprofile(targetPubkeyHex, effectiveRelays)
    : null

  const lud16Value = targetIdentity.lud16?.trim()

  const shareProfileName = getContactShareProfileName(
    targetIdentity.displayName,
    privacyMode
  )

  function handleOpenQrOverlay() {
    setQrOverlayKey((current) => current + 1)
    setQrOverlayVisible(true)
  }

  function handleCloseQrOverlay() {
    setQrOverlayVisible(false)
  }

  function navigateToPayment(
    method: PaymentMethod,
    invoice?: string,
    zapRequestJson?: string,
    amountSats?: number
  ) {
    paymentSheetRef.current?.close()

    const bolt11 = invoice || pendingInvoice[0]?.invoice
    const reqJson = zapRequestJson || pendingInvoice[0]?.zapRequestJson || ''
    const sats = amountSats ?? payAmount
    pendingInvoice[1](null)

    if (bolt11 && npub) {
      useZapFlowStore.getState().setPendingZap({
        amountSats: sats,
        invoice: bolt11,
        nostrUri: targetNpub,
        noteNpub: npub,
        paymentMethod: method,
        zapRequestJson: reqJson
      })
    }

    if (method.type === 'lightning') {
      router.navigate({
        params: bolt11 ? { invoice: bolt11 } : undefined,
        pathname: '/signer/lightning/pay'
      })
    } else if (method.type === 'ecash') {
      if (method.accountId) {
        setEcashActiveAccountId(method.accountId)
      }
      router.navigate({
        params: bolt11 ? { invoice: bolt11 } : undefined,
        pathname: '/signer/ecash/send'
      })
    } else if (method.type === 'ark' && method.accountId && bolt11) {
      router.navigate({
        params: {
          amountSats: String(sats),
          id: method.accountId,
          invoice: bolt11
        },
        pathname: '/signer/ark/account/[id]/pay-invoice'
      })
    }
  }

  function presentZapInvoice(
    invoice: string,
    zapRequestJson: string,
    amountSats: number
  ) {
    pendingInvoice[1]({ invoice, zapRequestJson })

    if (availablePaymentMethods.length === 1) {
      navigateToPayment(
        availablePaymentMethods[0],
        invoice,
        zapRequestJson,
        amountSats
      )
      return
    }

    setPayAmount(amountSats)
    paymentSheetRef.current?.snapToIndex(0)
  }

  async function handleZap() {
    if (availablePaymentMethods.length === 0) {
      return
    }
    if (!targetIdentity.lud16) {
      return
    }
    if (!owner?.nsec) {
      return
    }

    const amountSats = 21
    setZapLoading(true)

    try {
      if (!targetPubkeyHex) {
        setZapLoading(false)
        return
      }
      const { invoice, zapRequestJson } = await initiateZap({
        amountSats,
        recipientLud16: targetIdentity.lud16,
        recipientPubkeyHex: targetPubkeyHex,
        relays: effectiveRelays,
        senderNsec: owner.nsec
      })

      setZapLoading(false)
      presentZapInvoice(invoice, zapRequestJson, amountSats)
    } catch {
      setZapLoading(false)
    }
  }

  function handleNotePress(payload: {
    id: string
    kind: number
    pubkey: string
  }) {
    const nevent = nip19.neventEncode({
      author: payload.pubkey,
      id: payload.id,
      kind: payload.kind
    })
    router.navigate({
      params: { nostrUri: nevent, npub },
      pathname: '/signer/nostr/account/[npub]/note'
    })
  }

  function handleZapPress(receipt: ZapReceiptInfo) {
    if (npub) {
      router.navigate(nostrZapDetailHref(npub, receipt.id))
    }
  }

  function handleAuthorPress(authorNpub: string) {
    router.navigate(nostrAuthorProfileHref(npub, authorNpub))
  }

  if (!targetPubkeyHex) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
          <SSText color="muted">
            {t('nostrIdentity.contact.invalidNpub')}
          </SSText>
          <SSButton
            label={t('common.back')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  if (!owner) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.contact.title')}</SSText>
          )
        }}
      />

      {isProfileLoading ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <ActivityIndicator color={Colors.white} size="large" />
        </SSVStack>
      ) : (
        <SSNostrFeedTabs
          header={
            <SSVStack gap="md">
              <SSNostrHeroCard
                identity={targetIdentity}
                nip05Valid={nip05Valid ?? null}
              />
              <SSVStack gap="md" style={styles.content}>
                <SSHStack gap="sm" style={styles.actionRow}>
                  {showZapButton ? (
                    <SSButton
                      disabled={zapLoading}
                      gradientType="special"
                      label={
                        zapLoading
                          ? t('nostrIdentity.note.zapSending')
                          : `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : 21} sats`
                      }
                      onPress={handleZap}
                      style={styles.halfButton}
                      variant="gradient"
                    />
                  ) : null}
                  <SSButton
                    gradientType="special"
                    label={t('nostrIdentity.contact.more')}
                    onPress={handleOpenQrOverlay}
                    style={
                      showZapButton ? styles.halfButton : styles.fullButton
                    }
                    variant="gradient"
                  />
                </SSHStack>

                {!targetIdentity.lud16 &&
                  availablePaymentMethods.length > 0 && (
                    <SSText size="xs" color="muted" center>
                      {t('nostrIdentity.note.zapEndpointNotFound')}
                    </SSText>
                  )}
                {availablePaymentMethods.length === 0 && (
                  <SSText color="muted" center size="sm">
                    {t('nostrIdentity.contact.noWallets')}
                  </SSText>
                )}
              </SSVStack>
            </SSVStack>
          }
          npub={targetNpub}
          relayConnected={relayConnected}
          relays={effectiveRelays}
          onNotePress={handleNotePress}
          onZapPress={handleZapPress}
          onAuthorPress={handleAuthorPress}
        />
      )}

      <SSPaymentMethodPicker
        ref={paymentSheetRef}
        onSelect={(method) => navigateToPayment(method)}
        methods={availablePaymentMethods}
        amountSats={payAmount}
        btcPrice={btcPrice}
        fiatCurrency={fiatCurrency}
      />

      <SSContactProfileQrOverlay
        key={qrOverlayKey}
        contactNprofile={contactNprofile}
        lud16={lud16Value}
        onClose={handleCloseQrOverlay}
        shareProfileName={shareProfileName}
        targetNpub={targetNpub}
        visible={qrOverlayVisible}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionRow: {
    width: '100%'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 48
  },
  content: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal
  },
  fullButton: {
    flex: 1,
    minWidth: 0
  },
  halfButton: {
    flex: 1,
    minWidth: 0
  }
})
