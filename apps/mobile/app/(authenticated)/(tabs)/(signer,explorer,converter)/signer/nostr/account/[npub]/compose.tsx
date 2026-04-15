import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { buildEnhancedZapTags } from '@/utils/nostrIdentity'

type ComposeParams = {
  npub: string
}

type AmountMode = 'none' | 'fixed' | 'range'

const MAX_NOTE_LENGTH = 5000

export default function NostrComposePage() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<ComposeParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = identity?.relays ?? globalRelays

  const [content, setContent] = useState('')
  const [publishing, setPublishing] = useState(false)

  const [amountMode, setAmountMode] = useState<AmountMode>('none')
  const [fixedAmount, setFixedAmount] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [customLnurl, setCustomLnurl] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const charCount = content.length

  function validateAmounts(): string | null {
    if (amountMode === 'fixed') {
      const val = parseInt(fixedAmount, 10)
      if (!val || val <= 0) return t('nostrIdentity.compose.invalidAmount')
    }
    if (amountMode === 'range') {
      const min = parseInt(minAmount, 10)
      const max = parseInt(maxAmount, 10)
      if (!min || min <= 0) return t('nostrIdentity.compose.invalidMin')
      if (!max || max <= 0) return t('nostrIdentity.compose.invalidMax')
      if (max < min) return t('nostrIdentity.compose.maxBelowMin')
    }
    if (goalAmount) {
      const val = parseInt(goalAmount, 10)
      if (isNaN(val) || val <= 0) return t('nostrIdentity.compose.invalidGoal')
    }
    if (maxUses) {
      const val = parseInt(maxUses, 10)
      if (isNaN(val) || val <= 0) return t('nostrIdentity.compose.invalidUses')
    }
    if (customLnurl && !customLnurl.includes('@')) {
      return t('nostrIdentity.compose.invalidLnurl')
    }
    return null
  }

  const canPublish =
    content.trim().length > 0 &&
    charCount <= MAX_NOTE_LENGTH &&
    !publishing &&
    !!identity?.nsec

  function buildTags(): string[][] {
    if (amountMode === 'none') return []

    const zapMin =
      amountMode === 'fixed'
        ? parseInt(fixedAmount, 10)
        : parseInt(minAmount, 10)
    const zapMax =
      amountMode === 'fixed'
        ? parseInt(fixedAmount, 10)
        : parseInt(maxAmount, 10)

    return buildEnhancedZapTags({
      zapMin: zapMin || undefined,
      zapMax: zapMax || undefined,
      zapGoal: goalAmount ? parseInt(goalAmount, 10) : undefined,
      zapUses: maxUses ? parseInt(maxUses, 10) : undefined,
      zapLnurl: customLnurl || undefined
    })
  }

  async function handlePublish() {
    if (!canPublish || !identity?.nsec) return

    const validationError = validateAmounts()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setPublishing(true)
    try {
      const tags = buildTags()
      const api = new NostrAPI(effectiveRelays)
      await api.publishNote(identity.nsec, content.trim(), tags)

      toast.success(t('nostrIdentity.compose.published'))
      router.back()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('nostrIdentity.compose.publishFailed')
      toast.error(message)
    } finally {
      setPublishing(false)
    }
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  if (identity.isWatchOnly) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>
                {t('nostrIdentity.compose.title')}
              </SSText>
            )
          }}
        />
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
          <SSText color="muted">
            {t('nostrIdentity.keys.watchOnly')}
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

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {t('nostrIdentity.compose.title')}
            </SSText>
          )
        }}
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SSVStack gap="md" style={styles.container}>
            <SSVStack gap="xs">
              <SSText size="xs" color="muted">
                {identity.displayName || t('nostrIdentity.title')}
              </SSText>
            </SSVStack>

            <TextInput
              style={styles.input}
              placeholderTextColor={Colors.gray[500]}
              placeholder={t('nostrIdentity.compose.placeholder')}
              multiline
              autoFocus
              maxLength={MAX_NOTE_LENGTH}
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
            />

            <SSText size="xxs" color="muted" style={styles.charCount}>
              {charCount}/{MAX_NOTE_LENGTH}
            </SSText>

            <SSVStack gap="sm" style={styles.zapTagsSection}>
              <SSText size="xs" color="muted" uppercase>
                {t('nostrIdentity.compose.paymentRequest')}
              </SSText>

              <SSHStack gap="sm">
                {(['none', 'fixed', 'range'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeButton,
                      amountMode === mode && styles.modeButtonActive
                    ]}
                    onPress={() => setAmountMode(mode)}
                    activeOpacity={0.6}
                  >
                    <SSText
                      size="xs"
                      weight={amountMode === mode ? 'bold' : 'regular'}
                      center
                    >
                      {t(`nostrIdentity.compose.mode_${mode}`)}
                    </SSText>
                  </TouchableOpacity>
                ))}
              </SSHStack>

              {amountMode === 'fixed' && (
                <TextInput
                  style={styles.amountInput}
                  placeholderTextColor={Colors.gray[500]}
                  placeholder={t('nostrIdentity.compose.fixedPlaceholder')}
                  keyboardType="number-pad"
                  value={fixedAmount}
                  onChangeText={setFixedAmount}
                />
              )}

              {amountMode === 'range' && (
                <SSHStack gap="sm">
                  <TextInput
                    style={[styles.amountInput, styles.halfInput]}
                    placeholderTextColor={Colors.gray[500]}
                    placeholder={t('nostrIdentity.compose.minPlaceholder')}
                    keyboardType="number-pad"
                    value={minAmount}
                    onChangeText={setMinAmount}
                  />
                  <TextInput
                    style={[styles.amountInput, styles.halfInput]}
                    placeholderTextColor={Colors.gray[500]}
                    placeholder={t('nostrIdentity.compose.maxPlaceholder')}
                    keyboardType="number-pad"
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                  />
                </SSHStack>
              )}

              {amountMode !== 'none' && (
                <>
                  <TouchableOpacity
                    onPress={() => setShowAdvanced(!showAdvanced)}
                    activeOpacity={0.6}
                  >
                    <SSText size="xs" color="muted">
                      {showAdvanced
                        ? t('nostrIdentity.compose.hideAdvanced')
                        : t('nostrIdentity.compose.showAdvanced')}
                    </SSText>
                  </TouchableOpacity>

                  {showAdvanced && (
                    <SSVStack gap="sm">
                      <View>
                        <SSText
                          size="xxs"
                          color="muted"
                          style={styles.fieldLabel}
                        >
                          {t('nostrIdentity.compose.goalLabel')}
                        </SSText>
                        <TextInput
                          style={styles.amountInput}
                          placeholderTextColor={Colors.gray[500]}
                          placeholder={t(
                            'nostrIdentity.compose.goalPlaceholder'
                          )}
                          keyboardType="number-pad"
                          value={goalAmount}
                          onChangeText={setGoalAmount}
                        />
                      </View>

                      <View>
                        <SSText
                          size="xxs"
                          color="muted"
                          style={styles.fieldLabel}
                        >
                          {t('nostrIdentity.compose.usesLabel')}
                        </SSText>
                        <TextInput
                          style={styles.amountInput}
                          placeholderTextColor={Colors.gray[500]}
                          placeholder={t(
                            'nostrIdentity.compose.usesPlaceholder'
                          )}
                          keyboardType="number-pad"
                          value={maxUses}
                          onChangeText={setMaxUses}
                        />
                      </View>

                      <View>
                        <SSText
                          size="xxs"
                          color="muted"
                          style={styles.fieldLabel}
                        >
                          {t('nostrIdentity.compose.lnurlLabel')}
                        </SSText>
                        <TextInput
                          style={styles.amountInput}
                          placeholderTextColor={Colors.gray[500]}
                          placeholder={t(
                            'nostrIdentity.compose.lnurlPlaceholder'
                          )}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={customLnurl}
                          onChangeText={setCustomLnurl}
                        />
                      </View>
                    </SSVStack>
                  )}
                </>
              )}
            </SSVStack>

            <SSButton
              label={
                publishing
                  ? t('nostrIdentity.compose.publishing')
                  : t('nostrIdentity.compose.publish')
              }
              variant="gradient"
              gradientType="special"
              disabled={!canPublish}
              onPress={handlePublish}
            />
          </SSVStack>
        </ScrollView>
      </TouchableWithoutFeedback>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  amountInput: {
    backgroundColor: '#242424',
    borderRadius: 3,
    color: Colors.white,
    fontSize: 14,
    padding: 10
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60
  },
  charCount: {
    alignSelf: 'flex-end'
  },
  container: {
    paddingBottom: 40,
    paddingTop: 8
  },
  fieldLabel: {
    marginBottom: 4
  },
  halfInput: {
    flex: 1
  },
  input: {
    backgroundColor: '#242424',
    borderRadius: 3,
    color: Colors.white,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 200,
    minHeight: 100,
    padding: 12,
    textAlignVertical: 'top'
  },
  modeButton: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8
  },
  modeButtonActive: {
    borderColor: Colors.white
  },
  zapTagsSection: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 12
  }
})
