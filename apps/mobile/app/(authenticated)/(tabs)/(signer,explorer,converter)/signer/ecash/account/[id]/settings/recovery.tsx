import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { collectMintUrlsForRestore } from '@/utils/ecashBackup'

export default function EcashAccountRecoveryPage() {
  const {
    activeAccount,
    mints,
    proofs,
    restoreAllAccountMintsFromSeed,
    restoreFromBackup
  } = useEcash()
  const [mintUrl, setMintUrl] = useState('')
  const [backupJson, setBackupJson] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const [isRestoringBackup, setIsRestoringBackup] = useState(false)
  const [result, setResult] = useState<{
    proofsFound: number
    totalAmount: number
    mintsScanned: number
    mintsFailed: number
  } | null>(null)

  const mintUrlsToRestore = collectMintUrlsForRestore(mints, proofs, mintUrl)
  const hasSeed = activeAccount?.hasSeed === true

  async function handleRestoreAll() {
    if (mintUrlsToRestore.length === 0) {
      toast.error(t('ecash.recovery.noMintsToRestore'))
      return
    }

    setIsRestoring(true)
    setResult(null)
    try {
      const restoreResult = await restoreAllAccountMintsFromSeed(mintUrl)
      setResult(restoreResult)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(t('ecash.recovery.restoreFailed', { error: reason }))
    } finally {
      setIsRestoring(false)
    }
  }

  function handleRestoreBackup() {
    setIsRestoringBackup(true)
    try {
      const parsed: unknown = JSON.parse(backupJson)
      restoreFromBackup(parsed)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(t('ecash.recovery.restoreFailed', { error: reason }))
    } finally {
      setIsRestoringBackup(false)
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.recovery.title')}</SSText>
          )
        }}
      />
      <SSScrollView showsVerticalScrollIndicator={false}>
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
                <SSText uppercase>{t('ecash.recovery.seedRecovery')}</SSText>
                <SSText color="muted" size="sm">
                  {t('ecash.recovery.seedRecoveryDescription')}
                </SSText>
              </SSVStack>

              {mints.length > 0 ? (
                <SSVStack gap="xs">
                  <SSText color="muted" size="sm">
                    {t('ecash.backup.connectedMints')}: {mints.length}
                  </SSText>
                  {mints.map((mint) => (
                    <SSText key={mint.url} size="sm">
                      {mint.name || mint.url}
                    </SSText>
                  ))}
                </SSVStack>
              ) : null}

              <SSVStack gap="xs">
                <SSText uppercase>{t('ecash.mint.url')}</SSText>
                <SSTextInput
                  value={mintUrl}
                  onChangeText={setMintUrl}
                  placeholder="https://mint.example.com"
                  keyboardType="url"
                />
              </SSVStack>

              <SSButton
                label={t('ecash.recovery.restoreAllMints')}
                onPress={handleRestoreAll}
                variant="gradient"
                gradientType="special"
                loading={isRestoring}
                disabled={mintUrlsToRestore.length === 0}
              />

              {result ? (
                <SSVStack gap="sm" style={styles.resultContainer}>
                  <SSText uppercase>{t('ecash.recovery.result')}</SSText>
                  <SSText>
                    {t('ecash.recovery.mintsScanned', {
                      count: result.mintsScanned
                    })}
                  </SSText>
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
                  {result.mintsFailed > 0 ? (
                    <SSText>
                      {t('ecash.recovery.mintsFailed', {
                        count: result.mintsFailed
                      })}
                    </SSText>
                  ) : null}
                </SSVStack>
              ) : null}
            </>
          )}

          <SSVStack gap="sm">
            <SSText uppercase>{t('ecash.recovery.backupTab')}</SSText>
            <SSText color="muted" size="sm">
              {t('ecash.recovery.backupInstructions')}
            </SSText>
            <SSTextInput
              value={backupJson}
              onChangeText={setBackupJson}
              placeholder={t('ecash.recovery.backupPlaceholder')}
              multiline
              style={styles.backupInput}
            />
            <SSButton
              label={t('ecash.recovery.validateAndRestore')}
              onPress={handleRestoreBackup}
              variant="outline"
              loading={isRestoringBackup}
              disabled={!backupJson.trim()}
            />
          </SSVStack>
        </SSVStack>
      </SSScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  backupInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    minHeight: 160,
    padding: 10,
    textAlign: 'left',
    textAlignVertical: 'top',
    width: '100%'
  },
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  resultContainer: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  }
})
