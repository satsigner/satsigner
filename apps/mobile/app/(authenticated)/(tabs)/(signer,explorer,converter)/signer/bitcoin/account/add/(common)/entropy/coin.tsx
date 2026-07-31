import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
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

export default function CoinEntropy() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const coinSize = Math.min(screenWidth * 0.4, 160)
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

  function handleFlip(bit: '0' | '1') {
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
            <SSText uppercase>{t('account.entropy.coin.title')}</SSText>
          )
        }}
      />
      <SSVStack gap="lg" style={{ flex: 1 }}>
        <View style={styles.binary}>
          <SSBinaryDisplay binary={bits} />
        </View>
        <SSVStack itemsCenter gap="lg" style={styles.bottom}>
          <SSVStack itemsCenter style={{ gap: -20 }}>
            <SSText size="8xl">{step}</SSText>
            <SSText size="sm" color="muted" uppercase>
              {t('common.of')} {length}
            </SSText>
          </SSVStack>
          <SSText size="sm" color="muted" center style={{ letterSpacing: 0.5 }}>
            {t(`account.entropy.coin.desc.${mnemonicWordCount}`)}
          </SSText>
          <SSText size="sm" color="muted" center>
            {t('account.entropy.coin.bitsNote')}
          </SSText>
          <SSHStack justifyBetween>
            <TouchableOpacity
              key="front"
              activeOpacity={1}
              style={[
                styles.coin,
                styles.coinDark,
                {
                  borderRadius: coinSize / 2,
                  height: coinSize,
                  width: coinSize
                }
              ]}
              onPress={() => handleFlip('0')}
            />
            <TouchableOpacity
              key="back"
              activeOpacity={1}
              style={[
                styles.coin,
                styles.coinLight,
                {
                  borderRadius: coinSize / 2,
                  height: coinSize,
                  width: coinSize
                }
              ]}
              onPress={() => handleFlip('1')}
            />
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
  coin: {
    backgroundColor: Colors.gray[75]
  },
  coinDark: {
    opacity: 0.2
  },
  coinLight: {
    opacity: 0.55
  },
  container: {
    paddingBottom: 12
  }
})
