import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSNostrFeedTabs from '@/components/SSNostrFeedTabs'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { useEcash } from '@/hooks/useEcash'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors } from '@/styles'
import { type EcashMint } from '@/types/models/Ecash'
import { type LNDConfig } from '@/types/models/LND'
import { type NostrIdentity } from '@/types/models/NostrIdentity'
import { initiateZap } from '@/utils/zap'

type ContactParams = {
  npub: string
  targetNpub: string
}

export default function NostrContactProfile() {
  const router = useRouter()
  const { npub, targetNpub } = useLocalSearchParams<ContactParams>()

  const owner = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = owner?.relays ?? globalRelays

  const [targetIdentity, setTargetIdentity] = useState<NostrIdentity | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [zapLoading, setZapLoading] = useState(false)
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false)
  const [payAmount, setPayAmount] = useState(0)

  const lightningConfig = useLightningStore((state) => state.config)
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const { mints } = useEcash()

  const pendingInvoice = useState<{
    invoice: string
    zapRequestJson: string
  } | null>(null)

  const availablePaymentMethods = buildPaymentMethods(lightningConfig, mints)

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
  }, [effectiveRelays, owner?.relayConnected, targetNpub])

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
      const hexPubkey = nip19.decode(targetNpub).data as string
      const { invoice, zapRequestJson } = await initiateZap({
        amountSats,
        recipientLud16: targetIdentity.lud16,
        recipientPubkeyHex: hexPubkey,
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
      setPaymentPickerVisible(true)
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
    setPaymentPickerVisible(false)

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
      router.navigate({
        params: bolt11 ? { invoice: bolt11 } : undefined,
        pathname: '/signer/ecash/send'
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
    <SSMainLayout>
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
          <SSVStack gap="md" style={styles.content}>
            <SSNostrHeroCard identity={targetIdentity} />

            {targetIdentity.lud16 &&
              availablePaymentMethods.length > 0 &&
              owner?.nsec && (
                <SSButton
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
            />
          </SSVStack>
        </ScrollView>
      )}

      <SSPaymentMethodPicker
        visible={paymentPickerVisible}
        onClose={() => setPaymentPickerVisible(false)}
        onSelect={(method) => navigateToPayment(method)}
        methods={availablePaymentMethods}
        amountSats={payAmount}
      />
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
    paddingBottom: 40
  }
})

function buildPaymentMethods(
  lightningConfig: LNDConfig | null,
  mints: EcashMint[]
): PaymentMethod[] {
  const methods: PaymentMethod[] = []
  if (lightningConfig) {
    methods.push({
      detail: lightningConfig.url,
      id: 'lightning',
      label: 'Lightning',
      type: 'lightning'
    })
  }
  if (mints.length > 0) {
    for (const mint of mints) {
      methods.push({
        detail: mint.name || mint.url,
        id: `ecash-${mint.url}`,
        label: 'ECash',
        type: 'ecash'
      })
    }
  }
  return methods
}
