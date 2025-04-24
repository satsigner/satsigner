import { type Network } from 'bdk-rn/lib/lib/enums'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { generateMnemonicFromEntropy, getFingerprint } from '@/api/bdk'
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
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'

const screenWidth = Dimensions.get('window').width
const diceSize = Math.min(screenWidth * 0.25, 120)

export default function DiceEntropy() {
  const router = useRouter()
  const { index } = useLocalSearchParams()

  const [mnemonicWordCount, setMnemonic, setFingerprint] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.mnemonicWordCount,
        state.setMnemonic,
        state.setFingerprint
      ])
    )
  const network = useBlockchainStore((state) => state.selectedNetwork)

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

  async function handleDicePress(value: number) {
    if (bits.length < length) {
      const updatedRolls = [...rolls, value]
      setRolls(updatedRolls)

      let base10 = BigInt(0)
      updatedRolls.forEach((digit) => {
        base10 = base10 * BigInt(6) + BigInt(digit)
      })

      let newBits = base10.toString(2)
      const padded = Math.ceil(newBits.length / 8) * 8
      newBits = newBits.padStart(padded, '0')
      setBits(newBits)

      const newStep = step + 1
      setStep(newStep)

      if (newBits.length >= length) {
        const mnemonic = await generateMnemonicFromEntropy(
          newBits.slice(0, length)
        )

        setMnemonic(mnemonic)

        const fingerprint = await getFingerprint(
          mnemonic,
          undefined,
          network as Network
        )
        setFingerprint(fingerprint)
        router.navigate(`/account/add/generate/mnemonic/${index}`)
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
            minHeight: 180,
            minWidth: '100%',
            borderRadius: 8,
            paddingVertical: 16,
            paddingHorizontal: 8,
            backgroundColor: Colors.gray[950]
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 24
  }
})
