import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { Label, formatTransactionLabels, formatUtxoLabels } from '@/utils/bip329'
import { shareFile } from '@/utils/filesystem'
import { Redirect, Stack, router } from 'expo-router'
import { useLocalSearchParams } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId)
    ])
  )

  if (! account) return <Redirect href="/" />

    const labels = [
      ...formatTransactionLabels(account.transactions),
      ...formatUtxoLabels(account.utxos)
    ]

  async function exportLabels() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const filename = `labels_${accountId}_${date}.json`
    shareFile({
      filename: filename,
      fileContent: JSON.stringify(labels),
      dialogTitle: 'Save Labels file',
      mimeType: 'application/json'
    })
  }

  //
  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText size="xl">{i18n.t('settings.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText
          center
          uppercase
          weight="bold"
          size="md"
          color="muted"
        >
          EXPORT BIP329 LABELS
        </SSText>
        <View
          style={{
            padding: 10,
            backgroundColor: Colors.gray[900],
            borderRadius: 5,
          }}
        >
          {labels.map((label, index) => (
            <SSText
              color="white"
              size="xs"
              weight='bold'
              key={index}
            >
              {index}. {JSON.stringify(label)}
            </SSText>
          ))}
        </View>
        <SSButton label="COPY TO CLIPBOARD" />
        <SSButton
          label="DOWNLOAD JSON"
          variant="secondary"
          onPress={exportLabels}
        />
        <SSButton label="DOWNLOAD CSV" variant="secondary" />
        <SSButton
          label="CANCEL"
          variant="ghost"
          onPress={() => router.back()}
        />
      </SSVStack>
    </ScrollView>
  )
}
