import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
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

  const [collapsedIndex, setCollapsedIndex] = useState<number>(0)

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
          <SSMultisigCountSelector
            maxCount={12}
            requiredNumber={requiredParticipantsCount!}
            totalNumber={participantsCount!}
            viewOnly
          />
          <SSText center>{t('account.addOrGenerateKeys')}</SSText>
        </SSVStack>
        <ScrollView>
          <SSVStack gap="none">
            {Array.from({ length: participantsCount! }, (_, i) => i).map(
              (index) => (
                <SSMultisigKeyControl
                  key={index}
                  isBlackBackground={index % 2 === 0}
                  collapsed={collapsedIndex === index}
                  collapseChanged={(value) => value && setCollapsedIndex(index)}
                  index={index}
                  creating
                  participant={participants![index]}
                />
              )
            )}
          </SSVStack>
          <SSVStack style={{ padding: 16 }}>
            <SSButton
              label={t('common.confirm')}
              variant="secondary"
              disabled={!isValidParticipantSeeds}
              onPress={handleOnPressConfirm}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={handleOnPressCancel}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}
