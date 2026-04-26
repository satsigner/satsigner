import { Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

export default function EcashAccountRecoveryPage() {
  const { activeAccount, mints, restoreFromSeed } = useEcash()
  const [mintUrl, setMintUrl] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const [result, setResult] = useState<{
    proofsFound: number
    totalAmount: number
  } | null>(null)

  async function handleRestore() {
    const urlToRestore = mintUrl.trim()
    if (!urlToRestore) {
      toast.error(t('ecash.mint.enterUrl'))
      return
    }

    setIsRestoring(true)
    setResult(null)
    try {
      const restoreResult = await restoreFromSeed(urlToRestore)
      setResult(restoreResult)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`${t('ecash.error.networkError')}: ${reason}`)
    } finally {
      setIsRestoring(false)
    }
  }

  function handleSelectMint(url: string) {
    setMintUrl(url)
  }

  const hasSeed = activeAccount?.hasSeed === true

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.recovery.seedRecovery')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          {!hasSeed ? (
            <SSVStack gap="sm">
              <SSText color="muted">
                {t('ecash.recovery.noSeedAvailable')}
              </SSText>
            </SSVStack>
          ) : (
            <>
              <SSVStack gap="sm">
                <SSText color="muted" size="sm">
                  {t('ecash.recovery.seedRecoveryDescription')}
                </SSText>
              </SSVStack>

              <SSVStack gap="xs">
                <SSText uppercase>{t('ecash.mint.url')}</SSText>
                <SSTextInput
                  value={mintUrl}
                  onChangeText={setMintUrl}
                  placeholder="https://mint.example.com"
                  keyboardType="url"
                />
              </SSVStack>

              {mints.length > 0 && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="sm">
                    {t('ecash.recovery.selectConnectedMint')}
                  </SSText>
                  {mints.map((mint) => (
                    <SSButton
                      key={mint.url}
                      label={mint.name || mint.url}
                      onPress={() => handleSelectMint(mint.url)}
                      variant="subtle"
                      style={styles.mintButton}
                    />
                  ))}
                </SSVStack>
              )}

              <SSButton
                label={t('ecash.recovery.restoreProofs')}
                onPress={handleRestore}
                variant="gradient"
                gradientType="special"
                loading={isRestoring}
                disabled={!mintUrl.trim()}
              />

              {result && (
                <SSVStack gap="sm" style={styles.resultContainer}>
                  <SSText uppercase>{t('ecash.recovery.result')}</SSText>
                  <SSText>
                    {t('ecash.recovery.proofsFound', {
                      count: result.proofsFound
                    })}
                  </SSText>
                  <SSText>
                    {t('ecash.recovery.totalAmount', {
                      amount: result.totalAmount
                    })}
                  </SSText>
                </SSVStack>
              )}
            </>
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
  mintButton: {
    marginBottom: 2,
    opacity: 0.7
  },
  resultContainer: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  }
})
