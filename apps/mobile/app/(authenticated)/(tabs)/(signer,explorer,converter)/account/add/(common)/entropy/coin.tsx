import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSBinaryDisplay from '@/components/SSBinaryDisplay'
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

const screenWidth = Dimensions.get('window').width
const coinSize = Math.min(screenWidth * 0.4, 160)

export default function CoinEntropy() {
  const router = useRouter()
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

  const [step, setStep] = useState(0)
  const [bits, setBits] = useState('')

  async function handleFlip(bit: '0' | '1') {
    if (step < length) {
      const newBits = bits + bit
      setBits(newBits)
      const newStep = step + 1
      setStep(newStep)

      if (newStep === length) {
        const mnemonic = generateMnemonicFromEntropy(newBits, mnemonicWordList)
        setMnemonic(mnemonic)
        const fingerprint = getFingerprintFromMnemonic(mnemonic)
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
            <SSText uppercase>{t('account.entropy.coin.title')}</SSText>
          )
        }}
      />
      <SSVStack itemsCenter gap="lg" justifyBetween style={{ flex: 1 }}>
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
          style={{
            flex: 1,
            gap: 32,
            marginBottom: 12
          }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack itemsCenter gap="lg">
            <SSVStack itemsCenter gap="lg">
              <SSVStack itemsCenter style={{ gap: -20 }}>
                <SSText size="8xl">{step}</SSText>
                <SSText size="sm" color="muted" uppercase>
                  {t('common.of')} {length}
                </SSText>
              </SSVStack>
              <SSText
                size="sm"
                color="muted"
                center
                style={{ letterSpacing: 0.5 }}
              >
                {t(`account.entropy.coin.desc.${mnemonicWordCount}`)}
              </SSText>
            </SSVStack>
            <SSHStack justifyBetween style={{ marginTop: 24 }}>
              <TouchableOpacity
                key="front"
                activeOpacity={1}
                style={styles.coin}
                onPress={() => handleFlip('0')}
              />
              <TouchableOpacity
                key="back"
                activeOpacity={1}
                style={styles.coin}
                onPress={() => handleFlip('1')}
              />
            </SSHStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  coin: {
    backgroundColor: Colors.gray[75],
    height: coinSize,
    width: coinSize,
    borderRadius: coinSize / 2,
    opacity: 0.2
  },
  container: {
    paddingBottom: 12
  }
})
