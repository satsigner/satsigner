import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import { type PaymentMethod } from '@/components/SSPaymentMethodPicker'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DEFAULT_ONE_TAP_AMOUNT, DEFAULT_ZAP_PRESETS } from '@/constants/nostr'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'

type ZapSettingsParams = {
  npub: string
}

function buildPaymentMethods(
  lightningConfig: { url: string } | null,
  mints: { url: string; name?: string }[]
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
  for (const mint of mints) {
    methods.push({
      detail: mint.name || mint.url,
      id: `ecash-${mint.url}`,
      label: 'ECash',
      type: 'ecash'
    })
  }
  return methods
}

export default function ZapSettingsPage() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<ZapSettingsParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const updateIdentity = useNostrIdentityStore((state) => state.updateIdentity)

  const lightningConfig = useLightningStore((state) => state.config)
  const { mints } = useEcash()
  const wallets = buildPaymentMethods(lightningConfig, mints)

  const prefs = identity?.zapPreferences
  const [presets, setPresets] = useState<number[]>(
    prefs?.presetAmounts ?? DEFAULT_ZAP_PRESETS
  )
  const [newPreset, setNewPreset] = useState('')
  const [oneTapAmount, setOneTapAmount] = useState(
    String(prefs?.oneTapAmount ?? DEFAULT_ONE_TAP_AMOUNT)
  )
  const [autoApprove, setAutoApprove] = useState(prefs?.autoApprove ?? false)
  const [autoApproveWalletId, setAutoApproveWalletId] = useState<
    string | undefined
  >(prefs?.autoApproveWalletId)

  function handleAddPreset() {
    const val = parseInt(newPreset, 10)
    if (!val || val <= 0) {
      return
    }
    if (presets.includes(val)) {
      setNewPreset('')
      return
    }
    setPresets([...presets, val].toSorted((a, b) => a - b))
    setNewPreset('')
  }

  function handleRemovePreset(amount: number) {
    setPresets(presets.filter((p) => p !== amount))
  }

  function handleSave() {
    if (!npub) {
      return
    }
    const parsedOneTap = parseInt(oneTapAmount, 10) || DEFAULT_ONE_TAP_AMOUNT
    updateIdentity(npub, {
      zapPreferences: {
        autoApprove,
        autoApproveWalletId: autoApprove ? autoApproveWalletId : undefined,
        oneTapAmount: parsedOneTap,
        presetAmounts: presets.length > 0 ? presets : DEFAULT_ZAP_PRESETS
      }
    })
    toast.success(t('nostrIdentity.zapSettings.saved'))
    router.back()
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
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
            <SSText uppercase>{t('nostrIdentity.zapSettings.title')}</SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          <SSVStack gap="sm">
            <SSVStack gap="none">
              <SSText size="sm" color="muted" uppercase>
                {t('nostrIdentity.zapSettings.presets')}
              </SSText>
              <SSText size="xs" color="muted">
                {t('nostrIdentity.zapSettings.presetsHint')}
              </SSText>
            </SSVStack>
            <SSHStack gap="sm" style={styles.chipRow}>
              {presets.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.chip}
                  activeOpacity={0.6}
                  onPress={() => handleRemovePreset(amount)}
                >
                  <SSText size="sm">{amount}</SSText>
                  <SSText size="xs" color="muted" style={styles.chipX}>
                    x
                  </SSText>
                </TouchableOpacity>
              ))}
            </SSHStack>
            <SSTextInput
              placeholder="e.g. 2100"
              value={newPreset}
              onChangeText={setNewPreset}
              keyboardType="number-pad"
              align="left"
              onSubmitEditing={handleAddPreset}
            />
            <SSButton
              label={t('nostrIdentity.zapSettings.addPreset')}
              variant="outline"
              onPress={handleAddPreset}
            />
          </SSVStack>

          <SSSeparator color="gradient" />

          <SSVStack gap="sm">
            <SSVStack gap="none">
              <SSText size="sm" color="muted" uppercase>
                {t('nostrIdentity.zapSettings.oneTapAmount')}
              </SSText>
              <SSText size="xs" color="muted">
                {t('nostrIdentity.zapSettings.oneTapAmountHint')}
              </SSText>
            </SSVStack>
            <SSTextInput
              value={oneTapAmount}
              onChangeText={setOneTapAmount}
              keyboardType="number-pad"
              align="left"
            />
          </SSVStack>

          <SSSeparator color="gradient" />

          <View style={styles.autoApproveBox}>
            <SSVStack gap="md">
              <SSCheckbox
                label={t('nostrIdentity.zapSettings.autoApprove')}
                description={t('nostrIdentity.zapSettings.autoApproveHint')}
                selected={autoApprove}
                onPress={() => setAutoApprove(!autoApprove)}
                labelProps={{ color: 'white', size: 'md' }}
              />

              {autoApprove && (
                <SSVStack gap="sm">
                  <SSText size="xs" color="muted" uppercase>
                    {t('nostrIdentity.zapSettings.autoApproveWallet')}
                  </SSText>
                  {wallets.length === 0 ? (
                    <SSText size="sm" color="muted">
                      {t('nostrIdentity.zapSettings.noWallets')}
                    </SSText>
                  ) : (
                    wallets.map((w) => {
                      const isSelected = autoApproveWalletId === w.id
                      return (
                        <TouchableOpacity
                          key={w.id}
                          style={[
                            styles.walletRow,
                            isSelected && styles.walletRowSelected
                          ]}
                          activeOpacity={0.6}
                          onPress={() => setAutoApproveWalletId(w.id)}
                        >
                          <SSVStack gap="xxs">
                            <SSText size="md" weight="medium">
                              {w.label}
                            </SSText>
                            {w.detail ? (
                              <SSText size="xs" color="muted" numberOfLines={1}>
                                {w.detail}
                              </SSText>
                            ) : null}
                          </SSVStack>
                        </TouchableOpacity>
                      )
                    })
                  )}
                </SSVStack>
              )}
            </SSVStack>
          </View>

          <SSSeparator color="gradient" />

          <SSButton
            label={t('nostrIdentity.settings.save')}
            variant="secondary"
            onPress={handleSave}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  autoApproveBox: {
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    padding: 16
  },
  chip: {
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  chipRow: {
    flexWrap: 'wrap'
  },
  chipX: {
    opacity: 0.5
  },
  content: {
    paddingBottom: 40
  },
  emptyContainer: {
    paddingVertical: 60
  },
  walletRow: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  walletRowSelected: {
    borderColor: 'rgba(255, 255, 255, 0.68)'
  }
})
