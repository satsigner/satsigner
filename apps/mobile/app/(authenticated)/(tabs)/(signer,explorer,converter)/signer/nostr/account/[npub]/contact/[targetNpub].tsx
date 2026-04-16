import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSNostrFeedTabs from '@/components/SSNostrFeedTabs'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors } from '@/styles'
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

  const availablePaymentMethods = useMemo(() => {
    const methods: PaymentMethod[] = []
    if (lightningConfig) {
      methods.push({
        id: 'lightning',
        label: 'Lightning',
        type: 'lightning',
        detail: lightningConfig.url
      })
    }
    if (mints.length > 0) {
      for (const mint of mints) {
        methods.push({
          id: `ecash-${mint.url}`,
          label: 'ECash',
          type: 'ecash',
          detail: mint.name || mint.url
        })
      }
    }
    return methods
  }, [lightningConfig, mints])

  const loadProfile = useCallback(async () => {
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
  }, [effectiveRelays, owner?.relayConnected, targetNpub])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  async function handleZap() {
    if (availablePaymentMethods.length === 0) return
    if (!targetIdentity?.lud16) return
    if (!owner?.nsec) return

    const amountSats = 21
    setZapLoading(true)

    try {
      const hexPubkey = nip19.decode(targetNpub).data as string
      const { invoice, zapRequestJson } = await initiateZap({
        recipientLud16: targetIdentity.lud16,
        recipientPubkeyHex: hexPubkey,
        senderNsec: owner.nsec,
        amountSats,
        relays: effectiveRelays
      })

      setZapLoading(false)
      pendingInvoice[1]({ invoice, zapRequestJson })

      if (availablePaymentMethods.length === 1) {
        navigateToPayment(availablePaymentMethods[0], invoice, zapRequestJson, amountSats)
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
        noteNpub: npub,
        nostrUri: targetNpub,
        invoice: bolt11,
        amountSats: sats,
        zapRequestJson: reqJson,
        paymentMethod: method
      })
    }

    if (method.type === 'lightning') {
      router.navigate({
        pathname: '/signer/lightning/pay',
        params: bolt11 ? { invoice: bolt11 } : undefined
      })
    } else if (method.type === 'ecash') {
      router.navigate({
        pathname: '/signer/ecash/send',
        params: bolt11 ? { invoice: bolt11 } : undefined
      })
    }
  }

  function handleNotePress(payload: {
    id: string
    kind: number
    pubkey: string
  }) {
    const nevent = nip19.neventEncode({
      id: payload.id,
      author: payload.pubkey,
      kind: payload.kind
    })
    router.navigate({
      pathname: '/signer/nostr/account/[npub]/note',
      params: { npub, nostrUri: nevent }
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

            <SSNostrFeedTabs
              npub={targetNpub}
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
