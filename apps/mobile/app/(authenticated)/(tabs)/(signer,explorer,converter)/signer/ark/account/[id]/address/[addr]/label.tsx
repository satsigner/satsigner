import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import { useArkLabels, useSetArkLabel } from '@/hooks/useArkLabels'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function ArkAddressLabelPage() {
  const { id, addr } = useLocalSearchParams<{
    id: string
    addr: string
  }>()

  const labelsQuery = useArkLabels(id)
  const setLabelMutation = useSetArkLabel(id)

  if (!id || !addr) {
    return <Redirect href="/" />
  }

  const currentLabel = labelsQuery.data?.[addr]?.label ?? ''

  function updateLabel(label: string) {
    setLabelMutation.mutate(
      { label, ref: addr, type: 'addr' },
      { onSuccess: () => router.back() }
    )
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('address.label.title')}</SSText>
        }}
      />
      <SSVStack style={styles.container}>
        <SSAddressDisplay address={addr} />
        {labelsQuery.isSuccess && (
          <SSLabelInput label={currentLabel} onUpdateLabel={updateLabel} />
        )}
      </SSVStack>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20
  }
})
