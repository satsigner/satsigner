import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function FeeManagement() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const [rbf, cpfp, setRbf, setCpfp] = useTransactionBuilderStore(
    useShallow((state) => [state.rbf, state.cpfp, state.setRbf, state.setCpfp])
  )

  const [localRBF, setLocalRBF] = useState(rbf)
  const [localCPFP, setLocalCPFP] = useState(cpfp)

  function cancel() {
    router.navigate(`/account/${id}/signAndSend/ioPreview`)
  }

  function saveChanges() {
    setRbf(localRBF)
    setCpfp(localCPFP)
    router.navigate(`/account/${id}/signAndSend/ioPreview`)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>EXTRA SECURITY</SSText>
        }}
      />
      <SSMainLayout style={{ paddingBottom: 24, paddingTop: 12 }}>
        <SSVStack justifyBetween>
          <SSVStack gap="lg">
            <SSText center uppercase size="lg">
              FEE MANAGEMENT
            </SSText>
            <SSVStack>
              <SSCheckbox
                selected={localRBF}
                label="REPLACE BY FEE"
                onPress={() => setLocalRBF(!localRBF)}
              />
              <SSCheckbox
                selected={localCPFP}
                label="CHILD PAYS FOR PARENTS"
                onPress={() => setLocalCPFP(!localCPFP)}
              />
            </SSVStack>
          </SSVStack>
          <SSVStack>
            <SSButton
              variant="secondary"
              label={t('common.save')}
              onPress={saveChanges}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={cancel}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

export default FeeManagement
