import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'

import SSArkVtxoCard from '@/components/SSArkVtxoCard'
import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import { useArkLabels, useSetArkLabel } from '@/hooks/useArkLabels'
import { useArkVtxos } from '@/hooks/useArkVtxos'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function ArkVtxoLabelPage() {
  const { id, vtxoId } = useLocalSearchParams<{
    id: string
    vtxoId: string
  }>()

  const vtxosQuery = useArkVtxos(id)
  const labelsQuery = useArkLabels(id)
  const setLabelMutation = useSetArkLabel(id)

  if (!id || !vtxoId) {
    return <Redirect href="/" />
  }

  const vtxo = vtxosQuery.data?.find((item) => item.id === vtxoId)
  const currentLabel = labelsQuery.data?.[vtxoId]?.label ?? ''

  function updateLabel(label: string) {
    setLabelMutation.mutate(
      { label, ref: vtxoId, type: 'output' },
      { onSuccess: () => router.back() }
    )
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('transaction.edit.label.utxo')}</SSText>
        }}
      />
      <SSVStack style={styles.container}>
        {vtxo && <SSArkVtxoCard label={currentLabel} vtxo={vtxo} />}
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
