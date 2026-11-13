import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import { NOSTR_CHAT_POW_OFF, NOSTR_CHAT_POW_OPTIONS } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrChatSettingsStore } from '@/store/nostrChatSettings'
import { expectedPowHashes } from '@/utils/nostrPow'

export default function NostrIdentityPow() {
  const sendPowBits = useNostrChatSettingsStore((state) => state.sendPowBits)
  const setSendPowBits = useNostrChatSettingsStore(
    (state) => state.setSendPowBits
  )
  const minInboundPowBits = useNostrChatSettingsStore(
    (state) => state.minInboundPowBits
  )
  const setMinInboundPowBits = useNostrChatSettingsStore(
    (state) => state.setMinInboundPowBits
  )

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.settings.pow.title')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.content}>
          <PowBitsPicker
            title={t('nostrIdentity.settings.pow.sendTitle')}
            description={t('nostrIdentity.settings.pow.sendDescription')}
            value={sendPowBits}
            onChange={setSendPowBits}
          />
          <PowBitsPicker
            title={t('nostrIdentity.settings.pow.inboundTitle')}
            description={t('nostrIdentity.settings.pow.inboundDescription')}
            value={minInboundPowBits}
            onChange={setMinInboundPowBits}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

type PowBitsPickerProps = {
  description: string
  onChange: (bits: number) => void
  title: string
  value: number
}

function PowLevelSummary({ bits }: { bits: number }) {
  if (bits === NOSTR_CHAT_POW_OFF) {
    return (
      <SSText size="xxs" color="muted">
        {t('nostrIdentity.settings.pow.offDescription')}
      </SSText>
    )
  }
  return (
    <SSVStack gap="none">
      <SSText size="xxs" weight="medium">
        {t('nostrIdentity.compose.powLevelTitle', {
          bits,
          hashes: expectedPowHashes(bits)
        })}
      </SSText>
      <SSText size="xxs" color="muted">
        {t(`nostrIdentity.compose.powLevel${bits}`)}
      </SSText>
    </SSVStack>
  )
}

function PowBitsPicker({
  description,
  onChange,
  title,
  value
}: PowBitsPickerProps) {
  return (
    <SSVStack gap="sm">
      <SSText weight="medium">{title}</SSText>
      <SSText size="xs" color="muted">
        {description}
      </SSText>
      <SSHStack gap="xs">
        {NOSTR_CHAT_POW_OPTIONS.map((bits) => (
          <PowBitsOption
            key={bits}
            bits={bits}
            selected={bits === value}
            onSelect={onChange}
          />
        ))}
      </SSHStack>
      <PowLevelSummary bits={value} />
    </SSVStack>
  )
}

type PowBitsOptionProps = {
  bits: number
  onSelect: (bits: number) => void
  selected: boolean
}

function PowBitsOption({ bits, onSelect, selected }: PowBitsOptionProps) {
  function handlePress() {
    onSelect(bits)
  }

  return (
    <View style={styles.powOption}>
      <SSRadioButton
        label={
          bits === NOSTR_CHAT_POW_OFF
            ? t('nostrIdentity.settings.pow.off')
            : String(bits)
        }
        selected={selected}
        onPress={handlePress}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40
  },
  powOption: {
    flex: 1
  }
})
