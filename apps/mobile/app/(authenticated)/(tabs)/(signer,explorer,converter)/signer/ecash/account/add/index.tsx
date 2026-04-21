import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useEcashAccountBuilder } from '@/hooks/useEcashAccountBuilder'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type DetectedContent } from '@/utils/contentDetector'

type Step = 'name' | 'generate' | 'import' | 'confirm'

export default function EcashAccountAddPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('name')
  const [isCreating, setIsCreating] = useState(false)

  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  const {
    name,
    mnemonic,
    setName,
    setMnemonic,
    generateNewMnemonic,
    validateImportedMnemonic,
    createAccount,
    clearAccount
  } = useEcashAccountBuilder()

  const { pasteFromClipboard } = useClipboardPaste({
    onPaste: (content: string) => {
      setMnemonic(content)
    },
    showToast: true
  })

  function handleGenerateSeed() {
    generateNewMnemonic()
    setStep('confirm')
  }

  function handleImportSeed() {
    setStep('import')
  }

  function handleImportConfirm() {
    if (!validateImportedMnemonic(mnemonic)) {
      toast.error(t('ecash.account.invalidMnemonic'))
      return
    }
    setStep('confirm')
  }

  function handleSeedQRScanned(content: DetectedContent) {
    setCameraModalVisible(false)
    if (content.type === 'seed_qr' && content.metadata?.mnemonic) {
      setMnemonic(content.metadata.mnemonic as string)
      toast.success(t('ecash.account.seedQRScanned'))
    } else {
      toast.error(t('ecash.account.invalidSeedQR'))
    }
  }

  async function handleCreateAccount() {
    setIsCreating(true)
    try {
      const account = await createAccount()
      router.replace(`/signer/ecash/account/${account.id}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('ecash.error.networkError')
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  function handleBack() {
    if (step === 'name') {
      clearAccount()
      router.back()
      return
    }
    if (step === 'import' || step === 'generate') {
      setStep('name')
      return
    }
    if (step === 'confirm') {
      setMnemonic('')
      setStep('name')
    }
  }

  const mnemonicWords = mnemonic.trim().split(/\s+/)

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.account.addAccount')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          {step === 'name' && (
            <>
              <SSVStack gap="sm">
                <SSText uppercase>{t('ecash.account.name')}</SSText>
                <SSTextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('ecash.account.namePlaceholder')}
                />
              </SSVStack>
              <SSVStack gap="sm">
                <SSText uppercase>{t('ecash.account.seedSetup')}</SSText>
                <SSText color="muted" size="sm">
                  {t('ecash.account.seedDescription')}
                </SSText>
                <SSButton
                  label={t('ecash.account.generateSeed')}
                  onPress={handleGenerateSeed}
                  variant="gradient"
                  gradientType="special"
                />
                <SSButton
                  label={t('ecash.account.importSeed')}
                  onPress={handleImportSeed}
                  variant="outline"
                />
              </SSVStack>
            </>
          )}

          {step === 'import' && (
            <SSVStack gap="md">
              <SSText uppercase>{t('ecash.account.importSeed')}</SSText>
              <SSText color="muted" size="sm">
                {t('ecash.account.importSeedDescription')}
              </SSText>
              <SSTextInput
                value={mnemonic}
                onChangeText={setMnemonic}
                placeholder={t('ecash.account.mnemonicPlaceholder')}
                multiline
                style={styles.mnemonicInput}
              />
              <SSHStack gap="sm">
                <SSButton
                  label={t('common.paste')}
                  onPress={pasteFromClipboard}
                  variant="subtle"
                  style={styles.halfButton}
                />
                <SSButton
                  label={t('ecash.account.scanSeedQR')}
                  onPress={() => setCameraModalVisible(true)}
                  variant="subtle"
                  style={styles.halfButton}
                />
              </SSHStack>
              <SSButton
                label={t('common.confirm')}
                onPress={handleImportConfirm}
                variant="gradient"
                gradientType="special"
                disabled={mnemonic.trim().split(/\s+/).length !== 12}
              />
              <SSButton
                label={t('common.back')}
                onPress={handleBack}
                variant="subtle"
              />
            </SSVStack>
          )}

          {step === 'confirm' && (
            <SSVStack gap="md">
              <SSVStack gap="sm">
                <SSText uppercase>{t('ecash.account.yourSeedWords')}</SSText>
                <SSText color="muted" size="sm">
                  {t('ecash.account.seedWarning')}
                </SSText>
              </SSVStack>
              <View style={styles.wordGrid}>
                {mnemonicWords.map((word, index) => (
                  <View key={`${index}-${word}`} style={styles.wordItem}>
                    <SSText color="muted" size="xs" style={styles.wordIndex}>
                      {index + 1}
                    </SSText>
                    <SSText weight="medium">{word}</SSText>
                  </View>
                ))}
              </View>
              <SSVStack gap="sm" style={styles.actionButtons}>
                <SSButton
                  label={t('ecash.account.createAccount')}
                  onPress={handleCreateAccount}
                  variant="gradient"
                  gradientType="special"
                  loading={isCreating}
                />
                <SSButton
                  label={t('common.back')}
                  onPress={handleBack}
                  variant="subtle"
                />
              </SSVStack>
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleSeedQRScanned}
        context="bitcoin"
        title={t('ecash.account.scanSeedQR')}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionButtons: {
    paddingTop: 12
  },
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  halfButton: {
    flex: 1
  },
  mnemonicInput: {
    fontFamily: 'monospace',
    fontSize: 14,
    height: 'auto',
    minHeight: 100,
    padding: 12,
    textAlign: 'left',
    textAlignVertical: 'top'
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
