import * as Clipboard from 'expo-clipboard'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { Colors } from '@/styles'
import { buildLightningBackupData } from '@/utils/lightningBackup'
import { lndNodeCardTitle } from '@/utils/lndNodeCardTitle'

export default function LightningBackupPage() {
  const [config, status] = useLightningStore(
    useShallow((state) => [state.config, state.status])
  )
  const [showBackupData, setShowBackupData] = useState(false)
  const [backupData, setBackupData] = useState('')
  const [includeConnection, setIncludeConnection] = useState(true)
  const [includeNodeInformation, setIncludeNodeInformation] = useState(true)
  const [includeChannels, setIncludeChannels] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const nodeTitle =
    lndNodeCardTitle(
      status.nodeInfo?.alias ?? '',
      status.nodeInfo?.identity_pubkey ?? ''
    ) ||
    config?.url ||
    t('lightning.backup.notConnected')

  function generateBackupData() {
    setIsGenerating(true)
    try {
      const data = buildLightningBackupData(
        {
          channels: status.channels,
          config,
          isConnected: status.isConnected,
          lastSync: status.lastSync,
          nodeInfo: status.nodeInfo
        },
        {
          includeChannels,
          includeConnection,
          includeNodeInformation
        },
        new Date().toISOString()
      )
      setBackupData(JSON.stringify(data, null, 2))
      setShowBackupData(true)
    } catch {
      toast.error(t('lightning.backup.generationFailed'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopyBackup() {
    try {
      await Clipboard.setStringAsync(backupData)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('lightning.backup.copyFailed'))
    }
  }

  function handleClose() {
    setShowBackupData(false)
    setBackupData('')
  }

  function handleToggleConnection() {
    setIncludeConnection((current) => !current)
  }

  function handleToggleNodeInformation() {
    setIncludeNodeInformation((current) => !current)
  }

  function handleToggleChannels() {
    setIncludeChannels((current) => !current)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: () => null,
          headerTitle: () => (
            <SSText uppercase>{t('lightning.backup.title')}</SSText>
          )
        }}
      />
      <SSScrollView>
        <SSVStack gap="lg">
          <SSVStack gap="md">
            <SSText uppercase>{t('lightning.backup.title')}</SSText>
            <SSText color="muted">{t('lightning.backup.description')}</SSText>
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('lightning.backup.nodeSummary')}</SSText>
            <SSVStack gap="sm">
              <SSHStack>
                <SSText color="muted" style={{ flex: 1 }}>
                  {t('lightning.backup.alias')}:
                </SSText>
                <SSText
                  weight="medium"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {nodeTitle}
                </SSText>
              </SSHStack>
              <SSHStack>
                <SSText color="muted" style={{ flex: 1 }}>
                  {t('lightning.nodeSettings.url')}:
                </SSText>
                <SSText
                  weight="medium"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  type="mono"
                >
                  {config?.url ?? t('lightning.backup.notConnected')}
                </SSText>
              </SSHStack>
              <SSHStack>
                <SSText color="muted" style={{ flex: 1 }}>
                  {t('lightning.nodeSettings.channels')}:
                </SSText>
                <SSText weight="medium">{status.channels?.length ?? 0}</SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('lightning.backup.warning')}</SSText>
            <SSText color="muted" size="sm">
              {t('lightning.backup.warningText')}
            </SSText>
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('lightning.backup.backupOptions')}</SSText>
            <SSVStack gap="sm">
              <SSCheckbox
                label={t('lightning.backup.includeConnection')}
                selected={includeConnection}
                onPress={handleToggleConnection}
              />
              <SSCheckbox
                label={t('lightning.backup.includeNodeInformation')}
                selected={includeNodeInformation}
                onPress={handleToggleNodeInformation}
              />
              <SSCheckbox
                label={t('lightning.backup.includeChannels')}
                selected={includeChannels}
                onPress={handleToggleChannels}
              />
            </SSVStack>
          </SSVStack>
          <SSButton
            label={t('lightning.backup.generateBackup')}
            onPress={generateBackupData}
            variant="gradient"
            gradientType="special"
            loading={isGenerating}
          />
          {showBackupData ? (
            <SSVStack gap="md" style={styles.backupDataSection}>
              <SSText uppercase>{t('lightning.backup.backupData')}</SSText>
              <SSText color="muted" size="sm">
                {t('lightning.backup.backupInstructions')}
              </SSText>
              <SSTextInput
                value={backupData}
                multiline
                editable={false}
                style={styles.backupInput}
              />
              <SSHStack gap="sm">
                <SSButton
                  label={t('common.copy')}
                  onPress={handleCopyBackup}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <SSButton
                  label={t('common.close')}
                  onPress={handleClose}
                  variant="ghost"
                  style={{ flex: 1 }}
                />
              </SSHStack>
            </SSVStack>
          ) : null}
        </SSVStack>
      </SSScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  backupDataSection: {
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 20
  },
  backupInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    minHeight: 200,
    padding: 10,
    textAlign: 'left',
    textAlignVertical: 'top',
    width: '100%'
  }
})
