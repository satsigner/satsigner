import { type Network } from 'bdk-rn/lib/lib/enums'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
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

const screenWidth = Dimensions.get('window').width
const diceSize = Math.min(screenWidth * 0.25, 120)

export default function DiceEntropy() {
  const router = useRouter()
  const [mnemonicWordCount, setMnemonic, setFingerprint] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.mnemonicWordCount,
        state.setMnemonic,
        state.setFingerprint
      ])
    )
  const network = useBlockchainStore((state) => state.network)

  const length = 32 * (mnemonicWordCount / 3)
  const rolls = Math.ceil(length / Math.log2(6))

  const [step, setStep] = useState(0)
  const [bits, setBits] = useState('')

  const DiceIcons = [
    SSIconDiceOne,
    SSIconDiceTwo,
    SSIconDiceThree,
    SSIconDiceFour,
    SSIconDiceFive,
    SSIconDiceSix
  ]

  async function handleDicePress(value: number) {
    if (step < rolls && bits.length < length) {
      const newBits = bits + value.toString(2).padStart(3, '0')
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
        router.navigate('/account/add/generate/mnemonic/0')
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
      <SSVStack justifyBetween itemsCenter style={{ flex: 1 }}>
        <SSVStack itemsCenter gap="lg">
          <SSText size="8xl">{step}</SSText>
          <SSHStack style={styles.grid}>
            {DiceIcons.map((Icon, index) => (
              <SSDice key={index} onPress={() => handleDicePress(index)}>
                <Icon width={diceSize} height={diceSize} />
              </SSDice>
            ))}
          </SSHStack>
        </SSVStack>
        <View style={{ minHeight: 200 }}>
          <SSBinaryDisplay binary={bits} />
        </View>
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
    marginTop: 12
  }
})
