import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'

import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import { useArkLabels, useSetArkLabel } from '@/hooks/useArkLabels'
import { useArkMovements } from '@/hooks/useArkMovements'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getArkMovementLabelRef } from '@/utils/arkMovement'

import { MovementSummary } from '.'

export default function ArkMovementLabelPage() {
  const { id, movementId } = useLocalSearchParams<{
    id: string
    movementId: string
  }>()

  const movementsQuery = useArkMovements(id)
  const labelsQuery = useArkLabels(id)
  const setLabelMutation = useSetArkLabel(id)

  if (!id || !movementId) {
    return <Redirect href="/" />
  }

  const numericMovementId = Number(movementId)
  const movement = movementsQuery.data?.find(
    (item) => item.id === numericMovementId
  )
  const labelRef = movement ? getArkMovementLabelRef(movement) : null
  const currentLabel = labelRef
    ? (labelsQuery.data?.[labelRef]?.label ?? '')
    : ''

  function updateLabel(label: string) {
    if (!labelRef) {
      return
    }
    setLabelMutation.mutate(
      { label, ref: labelRef, type: 'tx' },
      { onSuccess: () => router.back() }
    )
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText>{t('transaction.edit.label.transaction')}</SSText>
          )
        }}
      />
      <SSVStack style={styles.container}>
        {movement && <MovementSummary movement={movement} />}
        {labelRef !== null && labelsQuery.isSuccess && (
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
