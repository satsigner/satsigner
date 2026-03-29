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

  const length = 32 * (mnemonicWordCount / 3)
  const approxRolls = Math.round(length / Math.log2(6))

  const [step, setStep] = useState(0)
  const [bits, setBits] = useState('')
  const [rolls, setRolls] = useState<number[]>([])

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
      <SSVStack
        itemsCenter
        gap="lg"
        style={{ flex: 1, justifyContent: 'space-evenly' }}
      >
        <View
          style={{
            backgroundColor: Colors.gray[950],
            borderRadius: 8,
            minHeight: 180,
            minWidth: '100%',
            paddingHorizontal: 8,
            paddingVertical: 16
          }}
        >
          <SSBinaryDisplay binary={bits} />
        </View>
        <ScrollView
          style={{ flex: 1, gap: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack itemsCenter gap="lg">
            <SSVStack itemsCenter gap="lg">
              <SSVStack itemsCenter style={{ gap: -20 }}>
                <SSText size="8xl">{step}</SSText>
                <SSText size="sm" color="muted" uppercase>
                  {t('common.of')} {approxRolls}
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
            </SSVStack>
            <SSHStack style={styles.grid}>
              {DiceIcons.map((Icon, index) => (
                <SSDice key={index} onPress={() => handleDicePress(index)}>
                  <Icon width={diceSize} height={diceSize} />
                </SSDice>
              ))}
            </SSHStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12
  },
  grid: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 24
  }
})
