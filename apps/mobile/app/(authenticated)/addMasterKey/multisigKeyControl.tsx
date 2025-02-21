import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMultisigCountView from '@/components/SSMultisigCountView'
import SSMultisigKeyControl from '@/components/SSMultisigKeyControl'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'

export default function MultisigKeyControl() {
  const router = useRouter()

  const [participants, participantsCount, requiredParticipantsCount] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.participants,
        state.participantsCount,
        state.requiredParticipantsCount
      ])
    )

  const isValidParticipantSeeds = useMemo(() => {
    return (
      participants?.length === participantsCount &&
      participants!.every((t) => t !== undefined)
    )
  }, [participants, participantsCount])

  const [collapsedIndex, setCollapsedIndex] = useState<number>(1)

  async function handleOnPressConfirm() {
    router.navigate('/addMasterKey/confirmScreen')
  }

  function handleOnPressCancel() {
    router.back()
  }

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.multiPartyContract')}</SSText>
          )
        }}
      />
      <SSVStack style={{ flex: 1 }}>
        <SSVStack
          style={{ backgroundColor: '#131313', paddingHorizontal: 16 }}
          gap="md"
        >
          <SSMultisigCountView
            maxCount={12}
            requiredCount={requiredParticipantsCount!}
            totalCount={participantsCount!}
          />
          <SSText center>{t('account.addOrGenerateKeys')}</SSText>
        </SSVStack>
        <ScrollView>
          <SSVStack gap="none">
            {Array.from({ length: participantsCount! }, (_, i) => i + 1).map(
              (index) => (
                <SSMultisigKeyControl
                  key={index}
                  isBlackBackground={index % 2 === 1}
                  collapsed={collapsedIndex === index}
                  collapseChanged={(value) => value && setCollapsedIndex(index)}
                  index={index}
                />
              )
            )}
          </SSVStack>
          <SSVStack style={{ padding: 16 }}>
            <SSButton
              label="Confirm"
              variant="secondary"
              disabled={!isValidParticipantSeeds}
              onPress={handleOnPressConfirm}
            />
            <SSButton
              label="Cancel"
              variant="ghost"
              onPress={handleOnPressCancel}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}
