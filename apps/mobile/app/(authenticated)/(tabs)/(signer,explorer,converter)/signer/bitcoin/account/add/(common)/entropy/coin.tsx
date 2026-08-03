import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSBinaryDisplay from '@/components/SSBinaryDisplay'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
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
  entropyFromCoinFlips,
  isSequenceWeak,
  mixWithSystemEntropy,
  requiredCoinFlips
} from '@/utils/entropy'

const COIN_SIDES = 2

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

  const bits = entropyBitsForWordCount(mnemonicWordCount)
  const totalFlips = requiredCoinFlips(bits)

  const [flips, setFlips] = useState<string[]>([])
  const [mixEntropy, setMixEntropy] = useState(true)

  const complete = flips.length >= totalFlips
  const weak = isSequenceWeak(flips, COIN_SIDES)
  const weakUnmixed = weak && !mixEntropy

  const previewEntropy =
    flips.length > 0
      ? entropyFromCoinFlips(flips, bits, { allowPartial: true })
      : ''

  function handleFlip(bit: '0' | '1') {
    if (flips.length >= totalFlips) {
      return
    }
    setFlips((current) => [...current, bit])
  }

  function handleUndo() {
    setFlips((current) => current.slice(0, -1))
  }

  function finishWithEntropy(entropy: string) {
    const mnemonic = generateMnemonicFromEntropy(entropy, mnemonicWordList)
    setMnemonic(mnemonic)
    setFingerprint(getFingerprintFromMnemonic(mnemonic))
    router.navigate(`/signer/bitcoin/account/add/generate/mnemonic/${index}`)
  }

  function buildEntropy() {
    const userEntropy = entropyFromCoinFlips(flips, bits)
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

  const coinShape = {
    borderRadius: coinSize / 2,
    height: coinSize,
    width: coinSize
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
        <View style={styles.display}>
          <SSBinaryDisplay binary={previewEntropy} />
          {flips.length > 0 ? (
            <SSText size="xs" color="muted" center style={styles.previewNote}>
              {mixEntropy
                ? t('account.entropy.previewMixedNote')
                : t('account.entropy.previewNote')}
            </SSText>
          ) : null}
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <SSVStack itemsCenter gap="lg">
            <SSVStack itemsCenter gap="lg">
              <SSVStack itemsCenter style={{ gap: -20 }}>
                <SSText size="8xl">{flips.length}</SSText>
                <SSText size="sm" color="muted" uppercase>
                  {t('common.of')} {totalFlips}
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
              {weak ? (
                <SSText size="sm" center style={styles.warningText}>
                  {mixEntropy
                    ? t('account.entropy.biasWarningMixed')
                    : t('account.entropy.biasWarningUnmixed')}
                </SSText>
              ) : null}
            </SSVStack>
            {complete ? null : (
              <SSHStack justifyBetween style={{ marginTop: 24 }}>
                <TouchableOpacity
                  key="heads"
                  activeOpacity={0.7}
                  style={[styles.coinHeads, coinShape]}
                  onPress={() => handleFlip('0')}
                >
                  <SSText size="xl" weight="bold" style={styles.headsLabel}>
                    0
                  </SSText>
                </TouchableOpacity>
                <TouchableOpacity
                  key="tails"
                  activeOpacity={0.7}
                  style={[styles.coinTails, coinShape]}
                  onPress={() => handleFlip('1')}
                >
                  <SSText size="xl" weight="bold">
                    1
                  </SSText>
                </TouchableOpacity>
              </SSHStack>
            )}
            {complete ? (
              <SSVStack gap="xs" style={styles.logBox}>
                <SSText size="xs" color="muted" uppercase>
                  {t('account.entropy.recordedInput')}
                </SSText>
                <SSText size="sm" style={styles.logText}>
                  {flips.join('')}
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
              {flips.length > 0 ? (
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
  coinHeads: {
    alignItems: 'center',
    backgroundColor: Colors.gray[75],
    justifyContent: 'center'
  },
  coinTails: {
    alignItems: 'center',
    backgroundColor: Colors.gray[700],
    borderColor: Colors.gray[75],
    borderWidth: 2,
    justifyContent: 'center'
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
  headsLabel: {
    color: Colors.gray[950]
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
  scroll: {
    flex: 1,
    gap: 32,
    marginBottom: 12
  },
  warningText: {
    color: Colors.warning
  }
})
