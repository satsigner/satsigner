import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSDatePicker from '@/components/SSDatePicker'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useApplyAccountBirthday } from '@/hooks/useApplyAccountBirthday'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Sizes } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatDate } from '@/utils/format'
import {
  estimateBirthHeight,
  estimateDateFromHeight
} from '@/utils/rpcScanStartHeight'

type BirthdayMode = 'date' | 'block'

const BITCOIN_GENESIS_YEAR = 2009

export default function AccountBirthdayPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { applyBirthday } = useApplyAccountBirthday()

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )
  const tip = useBlockchainStore((state) => state.lastKnownBlockHeight)

  const [mode, setMode] = useState<BirthdayMode>('date')
  const [date, setDate] = useState<Date>(
    () => account?.birthdayDate ?? new Date()
  )
  const [pickerKey, setPickerKey] = useState(0)
  const [blockInput, setBlockInput] = useState(() => {
    if (!account?.birthdayDate || tip <= 0) {
      return ''
    }
    return String(estimateBirthHeight(account.birthdayDate, tip))
  })
  const [blockError, setBlockError] = useState(false)
  const [saving, setSaving] = useState(false)

  const estimatedBlockDate = useMemo(() => {
    const height = parseInt(blockInput.trim(), 10)
    if (!Number.isFinite(height) || height < 0 || tip <= 0) {
      return null
    }
    return estimateDateFromHeight(height, tip)
  }, [blockInput, tip])

  if (!account || !id) {
    return <Redirect href="/" />
  }

  async function handleSaveDate() {
    setSaving(true)
    try {
      await applyBirthday(id, date)
      router.back()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBlock() {
    const height = parseInt(blockInput.trim(), 10)
    if (!Number.isFinite(height) || height < 0 || (tip > 0 && height > tip)) {
      setBlockError(true)
      return
    }
    setBlockError(false)
    setSaving(true)
    try {
      const approxDate = estimateDateFromHeight(height, tip || height)
      await applyBirthday(id, approxDate)
      router.back()
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      await applyBirthday(id, undefined)
      router.back()
    } finally {
      setSaving(false)
    }
  }

  function handleSelectDateMode() {
    setMode('date')
  }

  function handleSelectBlockMode() {
    setMode('block')
    const birthdayDate = account?.birthdayDate
    if (!blockInput && birthdayDate && tip > 0) {
      setBlockInput(String(estimateBirthHeight(birthdayDate, tip)))
    }
  }

  function handleToday() {
    setDate(new Date())
    setPickerKey((prev) => prev + 1)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.birthdayDate.label')}</SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <SSVStack gap="lg">
          <SSText color="muted" size="sm" center>
            {t('account.birthdayDate.pageHelper')}
          </SSText>

          <SSHStack gap="sm" style={styles.modeRow}>
            <SSRadioButton
              variant="outline"
              label={t('account.birthdayDate.mode.date')}
              selected={mode === 'date'}
              onPress={handleSelectDateMode}
              style={styles.modeButton}
            />
            <SSRadioButton
              variant="outline"
              label={t('account.birthdayDate.mode.block')}
              selected={mode === 'block'}
              onPress={handleSelectBlockMode}
              style={styles.modeButton}
            />
          </SSHStack>

          {mode === 'date' ? (
            <SSVStack gap="md" style={styles.dateSection}>
              <View style={styles.pickerWrap}>
                <SSDatePicker
                  key={pickerKey}
                  value={date}
                  onChange={setDate}
                  width="90%"
                  height={200}
                  fontSize={Sizes.text.fontSize['2xl']}
                  textColor={Colors.white}
                  fadeColor={Colors.gray[950]}
                  markColor={Colors.gray[950]}
                  markHeight={46}
                  startYear={BITCOIN_GENESIS_YEAR}
                />
              </View>
              <SSText center color="muted" size="sm">
                {formatDate(date)}
              </SSText>
              <SSButton
                label={t('date.today')}
                variant="outline"
                onPress={handleToday}
                disabled={date.toDateString() === new Date().toDateString()}
              />
              <SSButton
                label={t('common.save')}
                variant="secondary"
                loading={saving}
                onPress={() => {
                  void handleSaveDate()
                }}
              />
            </SSVStack>
          ) : (
            <SSVStack gap="md">
              <SSText color="muted" size="sm">
                {t('account.birthdayDate.blockHelper')}
              </SSText>
              <SSTextInput
                value={blockInput}
                onChangeText={(value) => {
                  setBlockInput(value)
                  setBlockError(false)
                }}
                placeholder={t('account.birthdayDate.blockPlaceholder')}
                keyboardType="number-pad"
                status={blockError ? 'invalid' : undefined}
                error={
                  blockError ? t('account.birthdayDate.blockError') : undefined
                }
              />
              {estimatedBlockDate ? (
                <SSText center color="muted" size="sm">
                  {t('account.birthdayDate.estimatedDate', {
                    date: formatDate(estimatedBlockDate)
                  })}
                </SSText>
              ) : null}
              {tip > 0 ? (
                <SSText center color="muted" size="xs">
                  {t('account.birthdayDate.currentTip', {
                    tip: tip.toLocaleString()
                  })}
                </SSText>
              ) : null}
              <SSButton
                label={t('common.save')}
                variant="secondary"
                loading={saving}
                onPress={() => {
                  void handleSaveBlock()
                }}
              />
            </SSVStack>
          )}

          {account.birthdayDate ? (
            <SSButton
              label={t('account.birthdayDate.clear')}
              variant="ghost"
              disabled={saving}
              onPress={() => {
                void handleClear()
              }}
            />
          ) : null}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  dateSection: {
    alignItems: 'center'
  },
  modeButton: {
    width: '48%'
  },
  modeRow: {
    justifyContent: 'space-between'
  },
  pickerWrap: {
    alignItems: 'center',
    width: '100%'
  },
  scroll: {
    paddingBottom: 40
  }
})
