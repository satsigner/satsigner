import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import { SSIconEllipsis } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSNostrFeedTabs from '@/components/SSNostrFeedTabs'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors, Layout } from '@/styles'
import { type NostrIdentity } from '@/types/models/NostrIdentity'
import { setClipboard } from '@/utils/clipboard'
import { getPubKeyHexFromNpub, validateNip05 } from '@/utils/nostr'
import { nostrZapDetailHref } from '@/utils/nostrNavigation'
import { buildPaymentMethods } from '@/utils/paymentMethods'
import { initiateZap } from '@/utils/zap'

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

  const [targetIdentity, setTargetIdentity] = useState<NostrIdentity | null>(
    null
  )

  const nip05 = targetIdentity?.nip05?.trim()
  const { data: nip05Valid } = useQuery({
    enabled: !!targetPubkeyHex && !!nip05,
    queryFn: () => validateNip05(targetPubkeyHex!, nip05!),
    queryKey: ['nostr', 'nip05-valid', targetNpub, nip05],
    staleTime: 5 * 60_000
  })
  const [loading, setLoading] = useState(true)
  const [zapLoading, setZapLoading] = useState(false)
  const [moreModalVisible, setMoreModalVisible] = useState(false)
  const paymentSheetRef = useRef<BottomSheetMethods>(null)
  const [payAmount, setPayAmount] = useState(0)

  const lightningConfig = useLightningStore((state) => state.config)
  const lightningNodeAlias = useLightningStore(
    (state) => state.status?.nodeInfo?.alias
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)
  const {
    accounts: ecashAccounts,
    allMints: ecashAllMints,
    setActiveAccountId: setEcashActiveAccountId
  } = useEcash()
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

  async function loadProfile() {
    if (!targetNpub || effectiveRelays.length === 0) {
      setLoading(false)
      return
    }

    if (owner?.relayConnected !== true) {
      setTargetIdentity({
        createdAt: Date.now(),
        isWatchOnly: true,
        npub: targetNpub
      })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const api = new NostrAPI(effectiveRelays)
      const profile = await api.fetchKind0(targetNpub)
      setTargetIdentity({
        banner: profile?.banner,
        createdAt: Date.now(),
        displayName: profile?.displayName,
        isWatchOnly: true,
        lud16: profile?.lud16,
        nip05: profile?.nip05,
        npub: targetNpub,
        picture: profile?.picture
      })
    } catch {
      setTargetIdentity({
        createdAt: Date.now(),
        isWatchOnly: true,
        npub: targetNpub
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [effectiveRelays, owner?.relayConnected, targetNpub]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleZap() {
    if (availablePaymentMethods.length === 0) {
      return
    }
    if (!targetIdentity?.lud16) {
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
    } catch {
      setZapLoading(false)
    }
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

      {loading || !targetIdentity ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <ActivityIndicator color={Colors.white} size="large" />
        </SSVStack>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSNostrHeroCard
            identity={targetIdentity}
            nip05Valid={nip05Valid ?? null}
          />
          <SSVStack gap="md" style={styles.content}>
            <SSHStack gap="sm">
              {targetIdentity.lud16 &&
                availablePaymentMethods.length > 0 &&
                owner?.nsec && (
                  <SSButton
                    style={{ flex: 1 }}
                    label={
                      zapLoading
                        ? t('nostrIdentity.note.zapSending')
                        : `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : 21} sats`
                    }
                    variant="gradient"
                    gradientType="special"
                    disabled={zapLoading}
                    onPress={handleZap}
                  />
                )}
              <SSIconButton onPress={() => setMoreModalVisible(true)}>
                <SSIconEllipsis width={22} height={6} />
              </SSIconButton>
            </SSHStack>

            {!targetIdentity.lud16 && availablePaymentMethods.length > 0 && (
              <SSText size="xs" color="muted" center>
                {t('nostrIdentity.note.zapEndpointNotFound')}
              </SSText>
            )}
            {availablePaymentMethods.length === 0 && (
              <SSText color="muted" center size="sm">
                {t('nostrIdentity.contact.noWallets')}
              </SSText>
            )}

            <SSNostrFeedTabs
              npub={targetNpub}
              profileLinkContextNpub={npub}
              relayConnected={owner?.relayConnected === true}
              relays={effectiveRelays}
              onNotePress={handleNotePress}
              onZapPress={(receipt) => {
                if (npub) {
                  router.navigate(nostrZapDetailHref(npub, receipt.id))
                }
              }}
            />
          </SSVStack>
        </ScrollView>
      )}

      <SSPaymentMethodPicker
        ref={paymentSheetRef}
        onSelect={(method) => navigateToPayment(method)}
        methods={availablePaymentMethods}
        amountSats={payAmount}
        btcPrice={btcPrice}
        fiatCurrency={fiatCurrency}
      />

      <SSModal
        visible={moreModalVisible}
        onClose={() => setMoreModalVisible(false)}
      >
        <SSButton
          label={t('nostrIdentity.contact.copyNpub')}
          variant="ghost"
          onPress={() => {
            void setClipboard(targetNpub ?? '')
            setMoreModalVisible(false)
          }}
        />
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 48
  },
  content: {
    paddingBottom: 40,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal
  }
})
