import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getEcashMnemonic } from '@/storage/encrypted'
import { Colors } from '@/styles'

export default function EcashSeedPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleReveal() {
    if (!id) {
      return
    }
    setIsLoading(true)
    try {
      const storedMnemonic = await getEcashMnemonic(id)
      setMnemonic(storedMnemonic)
      setIsRevealed(true)
    } finally {
      setIsLoading(false)
    }
  }

  function handleHide() {
    setMnemonic(null)
    setIsRevealed(false)
  }

  const words = mnemonic?.trim().split(/\s+/) ?? []

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.account.seedWords')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          <SSVStack gap="sm">
            <SSText color="muted" size="sm">
              {t('ecash.account.seedDisplayWarning')}
            </SSText>
          </SSVStack>

          {!isRevealed ? (
            <SSButton
              label={t('ecash.account.revealSeed')}
              onPress={handleReveal}
              variant="gradient"
              gradientType="special"
              loading={isLoading}
            />
          ) : (
            <SSVStack gap="md">
              <View style={styles.wordGrid}>
                {words.map((word, index) => (
                  <View key={`${index}-${word}`} style={styles.wordItem}>
                    <SSText color="muted" size="xs" style={styles.wordIndex}>
                      {index + 1}
                    </SSText>
                    <SSText weight="medium">{word}</SSText>
                  </View>
                ))}
              </View>
              <SSButton
                label={t('ecash.account.hideSeed')}
                onPress={handleHide}
                variant="outline"
              />
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%'
  },
  wordIndex: {
    minWidth: 20,
    textAlign: 'right'
  },
  wordItem: {
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8
  }
})
