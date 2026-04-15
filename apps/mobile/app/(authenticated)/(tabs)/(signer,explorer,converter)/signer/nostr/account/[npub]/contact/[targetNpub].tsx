import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { type NostrIdentity } from '@/types/models/NostrIdentity'

type ContactParams = {
  npub: string
  targetNpub: string
}

const ZAP_PRESETS = [21, 100, 500]

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
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false)
  const [payAmount, setPayAmount] = useState(0)

  const lightningConfig = useLightningStore((state) => state.config)
  const { mints } = useEcash()

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
  }, [effectiveRelays, targetNpub])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  function handleZap(amountSats: number) {
    if (availablePaymentMethods.length === 0) return
    if (availablePaymentMethods.length === 1) {
      navigateToPayment(availablePaymentMethods[0])
      return
    }
    setPayAmount(amountSats)
    setPaymentPickerVisible(true)
  }

  function navigateToPayment(method: PaymentMethod) {
    setPaymentPickerVisible(false)
    if (method.type === 'lightning') {
      router.navigate('/signer/lightning')
    } else if (method.type === 'ecash') {
      router.navigate('/signer/ecash')
    }
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
          <SSVStack gap="lg" style={styles.content}>
            <SSNostrHeroCard identity={targetIdentity} />

            <SSText size="sm" color="muted" center>
              {t('nostrIdentity.contact.zapHint')}
            </SSText>

            {availablePaymentMethods.length > 0 ? (
              <SSVStack gap="sm">
                {ZAP_PRESETS.map((amount) => (
                  <SSHStack key={amount} gap="sm" style={styles.zapRow}>
                    <SSText size="lg" weight="medium" style={styles.zapAmount}>
                      {amount} sats
                    </SSText>
                    <SSButton
                      label={t('nostrIdentity.note.zap')}
                      onPress={() => handleZap(amount)}
                      style={styles.zapButton}
                      variant="gradient"
                      gradientType="special"
                    />
                  </SSHStack>
                ))}
              </SSVStack>
            ) : (
              <SSText color="muted" center size="sm">
                {t('nostrIdentity.contact.noWallets')}
              </SSText>
            )}
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
  },
  zapAmount: {
    flex: 1
  },
  zapButton: {
    minWidth: 100
  },
  zapRow: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  }
})

