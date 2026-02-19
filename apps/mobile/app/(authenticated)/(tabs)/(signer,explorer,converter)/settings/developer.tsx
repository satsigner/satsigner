import { Stack } from 'expo-router'
import { useState } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSSwitch from '@/components/SSSwitch'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useWalletsStore } from '@/store/wallets'
import { runNetworkDiagnostics } from '@/utils/networkDiagnostics'

export default function Developer() {
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
  const [skipPin, setSkipPin] = useAuthStore(
    useShallow((state) => [state.skipPin, state.setSkipPin])
  )
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false)

  async function handleDeleteAccount() {
    deleteAccounts()
    deleteWallets()
    toast.error(t('settings.developer.accountsDeleted'))
  }

  async function handleRunDiagnostics() {
    setIsRunningDiagnostics(true)
    try {
      const report = await runNetworkDiagnostics()
      if (report.summary.failed === 0) {
        toast.success(
          `Network OK: ${report.summary.passed}/${report.summary.total} passed`
        )
      } else {
        const failedTests = report.results
          .filter((r) => !r.success)
          .map((r) => r.test)
          .join(', ')
        toast.error(`Network issues: ${failedTests}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Diagnostics failed: ${errorMsg}`)
    } finally {
      setIsRunningDiagnostics(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack gap="lg">
          <SSVStack>
            <SSButton
              label={t('settings.developer.deleteAccounts')}
              onPress={() => handleDeleteAccount()}
            />
          </SSVStack>
          <SSSeparator color="gradient" />
          <SSVStack gap="none">
            <SSSwitch
              value={skipPin}
              textOn={t('settings.developer.skipPin')}
              textOff={t('settings.developer.skipPin')}
              size="lg"
              position="right"
              onToggle={() => setSkipPin(!skipPin)}
            />
          </SSVStack>
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSText center color="muted">
              Network Diagnostics
            </SSText>
            <SSButton
              label={
                isRunningDiagnostics ? 'Running...' : 'Run Network Diagnostics'
              }
              onPress={handleRunDiagnostics}
              disabled={isRunningDiagnostics}
            />
            <SSText size="xs" color="muted" center>
              Tests HTTP, WebSocket, TCP, and DNS connectivity
            </SSText>
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
