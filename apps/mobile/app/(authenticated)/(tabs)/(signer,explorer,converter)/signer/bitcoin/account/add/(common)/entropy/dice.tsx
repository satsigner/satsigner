import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
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

export default function DiceEntropy() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const diceSize = Math.min(screenWidth * 0.22, 100)
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

  const length = 32 * (mnemonicWordCount / 3)
  const approxRolls = Math.round(length / Math.log2(6))

  const [step, setStep] = useState(0)
  const [bits, setBits] = useState('')
  const [rolls, setRolls] = useState<number[]>([])
  const [lastRoll, setLastRoll] = useState<number | null>(null)

  const DiceIcons = [
    SSIconDiceOne,
    SSIconDiceTwo,
    SSIconDiceThree,
    SSIconDiceFour,
    SSIconDiceFive,
    SSIconDiceSix
  ]

  function handleDicePress(value: number) {
    if (bits.length < length) {
      const updatedRolls = [...rolls, value]
      setRolls(updatedRolls)
      setLastRoll(value)

      let base10 = 0n
      for (const digit of updatedRolls) {
        base10 = base10 * 6n + BigInt(digit)
      }

      let newBits = base10.toString(2)
      const padded = Math.ceil(newBits.length / 8) * 8
      newBits = newBits.padStart(padded, '0')
      setBits(newBits)

      const newStep = step + 1
      setStep(newStep)

      if (newBits.length >= length) {
        const mnemonic = generateMnemonicFromEntropy(
          newBits.slice(0, length),
          mnemonicWordList
        )
        setMnemonic(mnemonic)
        const fingerprint = getFingerprintFromMnemonic(mnemonic)
        setFingerprint(fingerprint)
        router.navigate(
          `/signer/bitcoin/account/add/generate/mnemonic/${index}`
        )
      }
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
      <SSVStack gap="md" style={{ flex: 1 }}>
        <View style={styles.binary}>
          <SSBinaryDisplay binary={bits} />
        </View>
        <SSVStack itemsCenter gap="md" style={styles.bottom}>
          <SSVStack itemsCenter style={{ gap: -20 }}>
            <SSText size="8xl">{step}</SSText>
            <SSText size="sm" color="muted" uppercase>
              {t('common.of')} {approxRolls}
            </SSText>
          </SSVStack>
          <SSText size="sm" color="muted" center style={{ letterSpacing: 0.5 }}>
            {t(`account.entropy.dice.desc.${mnemonicWordCount}`)}
          </SSText>
          <SSText size="sm" color="muted" center>
            {t('account.entropy.dice.bitsNote')}
          </SSText>
          <SSHStack style={styles.grid}>
            {DiceIcons.map((Icon, index) => (
              <SSDice
                key={index}
                selected={lastRoll === index}
                onPress={() => handleDicePress(index)}
              >
                <Icon width={diceSize} height={diceSize} />
              </SSDice>
            ))}
          </SSHStack>
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  binary: {
    backgroundColor: Colors.gray[950],
    borderRadius: 8,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 16,
    width: '100%'
  },
  bottom: {
    flexShrink: 0,
    width: '100%'
  },
  container: {
    paddingBottom: 12
  },
  grid: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center'
  }
})
