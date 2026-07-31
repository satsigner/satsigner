import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconDiceFive,
  SSIconDiceFour,
  SSIconDiceOne,
  SSIconDiceSix,
  SSIconDiceThree,
  SSIconDiceTwo
} from '@/components/icons'
import SSBinaryDisplay from '@/components/SSBinaryDisplay'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSDice from '@/components/SSDice'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { Colors } from '@/styles'
import {
  generateMnemonicFromEntropy,
  getFingerprintFromMnemonic
} from '@/utils/bip39'
import {
  entropyBitsForWordCount,
  entropyFromDiceRolls,
  isSequenceBiased,
  mixWithSystemEntropy,
  requiredDiceRolls
} from '@/utils/entropy'

const DICE_ICONS = [
  SSIconDiceOne,
  SSIconDiceTwo,
  SSIconDiceThree,
  SSIconDiceFour,
  SSIconDiceFive,
  SSIconDiceSix
]

const DICE_FACES = 6
const PREVIEW_BITS = 128

export default function DiceEntropy() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const diceSize = Math.min(screenWidth * 0.25, 120)
  const { index } = useLocalSearchParams()

  const [mnemonicWordCount, mnemonicWordList, setMnemonic, setFingerprint] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.mnemonicWordCount,
        state.mnemonicWordList,
        state.setMnemonic,
        state.setFingerprint
      ])
    )

  const bits = entropyBitsForWordCount(mnemonicWordCount)
  const totalRolls = requiredDiceRolls(bits)

  const [rolls, setRolls] = useState<number[]>([])
  const [mixEntropy, setMixEntropy] = useState(true)

  const complete = rolls.length >= totalRolls
  const biased = isSequenceBiased(rolls.map(String), DICE_FACES)

  const previewEntropy =
    rolls.length > 0 ? entropyFromDiceRolls(rolls, PREVIEW_BITS) : ''

  function handleDicePress(face: number) {
    if (rolls.length >= totalRolls) {
      return
    }
    setRolls([...rolls, face])
  }

  function handleUndo() {
    setRolls(rolls.slice(0, -1))
  }

  function handleContinue() {
    const userEntropy = entropyFromDiceRolls(rolls, bits)
    const entropy = mixEntropy
      ? mixWithSystemEntropy(userEntropy, bits)
      : userEntropy

    const mnemonic = generateMnemonicFromEntropy(entropy, mnemonicWordList)
    setMnemonic(mnemonic)
    setFingerprint(getFingerprintFromMnemonic(mnemonic))
    router.navigate(`/signer/bitcoin/account/add/generate/mnemonic/${index}`)
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.entropy.dice.title')}</SSText>
          )
        }}
      />
      <SSVStack
        itemsCenter
        gap="lg"
        style={{ flex: 1, justifyContent: 'space-evenly' }}
      >
        <View style={styles.display}>
          <SSBinaryDisplay binary={previewEntropy} />
        </View>
        <ScrollView
          style={{ flex: 1, gap: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack itemsCenter gap="lg">
            <SSVStack itemsCenter gap="lg">
              <SSVStack itemsCenter style={{ gap: -20 }}>
                <SSText size="8xl">{rolls.length}</SSText>
                <SSText size="sm" color="muted" uppercase>
                  {t('common.of')} {totalRolls}
                </SSText>
              </SSVStack>
              <SSText
                size="sm"
                color="muted"
                center
                style={{ letterSpacing: 0.5 }}
              >
                {t(`account.entropy.dice.desc.${mnemonicWordCount}`)}
              </SSText>
              {biased ? (
                <SSText size="sm" color="muted" center>
                  {t('account.entropy.biasWarning')}
                </SSText>
              ) : null}
            </SSVStack>
            {complete ? null : (
              <SSHStack style={styles.grid}>
                {DICE_ICONS.map((Icon, iconIndex) => (
                  <SSDice
                    key={iconIndex}
                    onPress={() => handleDicePress(iconIndex + 1)}
                  >
                    <Icon width={diceSize} height={diceSize} />
                  </SSDice>
                ))}
              </SSHStack>
            )}
            <SSVStack gap="sm" style={styles.actions}>
              <SSCheckbox
                selected={mixEntropy}
                label={t('account.entropy.mixWithDevice')}
                onPress={() => setMixEntropy(!mixEntropy)}
              />
              <SSText size="xs" color="muted">
                {t('account.entropy.mixWithDeviceDescription')}
              </SSText>
              {rolls.length > 0 && !complete ? (
                <SSButton
                  variant="ghost"
                  label={t('common.undo')}
                  onPress={handleUndo}
                />
              ) : null}
              {complete ? (
                <SSButton
                  variant="secondary"
                  label={t('common.continue')}
                  onPress={handleContinue}
                />
              ) : null}
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 24,
    width: '100%'
  },
  container: {
    paddingBottom: 12
  },
  display: {
    backgroundColor: Colors.gray[950],
    borderRadius: 8,
    minHeight: 180,
    minWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 16
  },
  grid: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 24
  }
})
