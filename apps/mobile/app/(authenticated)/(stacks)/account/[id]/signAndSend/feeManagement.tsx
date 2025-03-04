import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'

function FeeManagement() {
  const [rbf, cpfp, setRbf, setCpfp] = useTransactionBuilderStore(
    useShallow((state) => [state.rbf, state.cpfp, state.setRbf, state.setCpfp])
  )

  const [localRBF, setLocalRBF] = useState(rbf)
  const [localCPFP, setLocalCPFP] = useState(cpfp)

  function cancel() {
    router.back()
  }

  function saveChanges() {
    setRbf(localRBF)
    setCpfp(localCPFP)
    router.back()
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
              {t('transaction.build.options.feeManagement')}
            </SSText>
            <SSVStack>
              <SSCheckbox
                selected={localRBF}
                label={t('bitcoin.rbf').toUpperCase()}
                onPress={() => setLocalRBF(!localRBF)}
              />
              <SSCheckbox
                selected={localCPFP}
                label={t('bitcoin.cpfp').toUpperCase()}
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
