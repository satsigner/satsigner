import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { toast } from 'sonner-native'
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
  isSequenceWeak,
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
  const rollSymbols = rolls.map(String)
  const weak = isSequenceWeak(rollSymbols, DICE_FACES)
  const weakUnmixed = weak && !mixEntropy

  const previewEntropy =
    rolls.length > 0
      ? entropyFromDiceRolls(rolls, bits, { allowPartial: true })
      : ''

  function handleDicePress(face: number) {
    if (rolls.length >= totalRolls) {
      return
    }
    setRolls((current) => [...current, face])
  }

  function handleUndo() {
    setRolls((current) => current.slice(0, -1))
  }

  function finishWithEntropy(entropy: string) {
    const mnemonic = generateMnemonicFromEntropy(entropy, mnemonicWordList)
    setMnemonic(mnemonic)
    setFingerprint(getFingerprintFromMnemonic(mnemonic))
    router.navigate(`/signer/bitcoin/account/add/generate/mnemonic/${index}`)
  }

  function buildEntropy() {
    const userEntropy = entropyFromDiceRolls(rolls, bits)
    return mixEntropy ? mixWithSystemEntropy(userEntropy, bits) : userEntropy
  }

  function handleContinue() {
    try {
      if (weakUnmixed) {
        Alert.alert(
          t('account.entropy.weakInputTitle'),
          t('account.entropy.weakInputUnmixed'),
          [
            { style: 'cancel', text: t('common.cancel') },
            {
              onPress: () => {
                try {
                  finishWithEntropy(buildEntropy())
                } catch {
                  toast.error(t('account.entropy.generateError'))
                }
              },
              style: 'destructive',
              text: t('account.entropy.continueAnyway')
            }
          ]
        )
        return
      }
      finishWithEntropy(buildEntropy())
    } catch {
      toast.error(t('account.entropy.generateError'))
    }
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
          {rolls.length > 0 ? (
            <SSText size="xs" color="muted" center style={styles.previewNote}>
              {mixEntropy
                ? t('account.entropy.previewMixedNote')
                : t('account.entropy.previewNote')}
            </SSText>
          ) : null}
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
              {weak ? (
                <SSText size="sm" center style={styles.warningText}>
                  {mixEntropy
                    ? t('account.entropy.biasWarningMixed')
                    : t('account.entropy.biasWarningUnmixed')}
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
            {complete ? (
              <SSVStack gap="xs" style={styles.logBox}>
                <SSText size="xs" color="muted" uppercase>
                  {t('account.entropy.recordedInput')}
                </SSText>
                <SSText size="sm" style={styles.logText}>
                  {rolls.join(' ')}
                </SSText>
              </SSVStack>
            ) : null}
            <SSVStack gap="sm" style={styles.actions}>
              <SSCheckbox
                selected={mixEntropy}
                label={t('account.entropy.mixWithDevice')}
                onPress={() => setMixEntropy((current) => !current)}
              />
              <SSText size="xs" color="muted">
                {t('account.entropy.mixWithDeviceDescription')}
              </SSText>
              {rolls.length > 0 ? (
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
    gap: 8,
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
  },
  logBox: {
    backgroundColor: Colors.gray[900],
    borderCurve: 'continuous',
    borderRadius: 8,
    padding: 12,
    width: '100%'
  },
  logText: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 1
  },
  previewNote: {
    marginTop: 4
  },
  warningText: {
    color: Colors.warning
  }
})
