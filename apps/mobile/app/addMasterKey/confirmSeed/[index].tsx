import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSWarningModal from '@/components/SSWarningModal'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'

type ConfirmSeedSearchParams = {
  index: string
}

export default function ConfirmSeed() {
  const accountStore = useAccountStore()
  const router = useRouter()
  const { index } = useLocalSearchParams<ConfirmSeedSearchParams>()

  const [selectedCheckbox1, setSelectedCheckbox1] = useState(false)
  const [selectedCheckbox2, setSelectedCheckbox2] = useState(false)
  const [selectedCheckbox3, setSelectedCheckbox3] = useState(false)

  const [warningModalVisible, setWarningModalVisible] = useState(false)

  function handleSelectCheckbox(checkboxNumber: 1 | 2 | 3) {
    setSelectedCheckbox1(false)
    setSelectedCheckbox2(false)
    setSelectedCheckbox3(false)

    if (checkboxNumber === 1) setSelectedCheckbox1(true)
    if (checkboxNumber === 2) setSelectedCheckbox2(true)
    if (checkboxNumber === 3) setSelectedCheckbox3(true)
  }

  function handleNavigateNextWord() {
    if (!accountStore.currentAccount.seedWordCount) return
    if (+index + 1 < accountStore.currentAccount.seedWordCount)
      router.push(`/addMasterKey/confirmSeed/${+index + 1}`)
    else router.push(`/accountList/`) //TODO: Change me
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <SSVStack justifyBetween>
        <SSVStack gap="lg">
          <SSText color="white" uppercase style={{ alignSelf: 'center' }}>
            {`${i18n.t('common.confirm')} ${i18n.t('bitcoin.word')} ${+index + 1}`}
          </SSText>
          <SSVStack gap="lg">
            <SSCheckbox
              label="word1"
              selected={selectedCheckbox1}
              onPress={() => handleSelectCheckbox(1)}
            />
            <SSCheckbox
              label="word2"
              selected={selectedCheckbox2}
              onPress={() => handleSelectCheckbox(2)}
            />
            <SSCheckbox
              label="word3"
              selected={selectedCheckbox3}
              onPress={() => handleSelectCheckbox(3)}
            />
          </SSVStack>
        </SSVStack>
        <SSVStack>
          <SSButton
            label={i18n.t('common.next')}
            variant="secondary"
            onPress={() => handleNavigateNextWord()}
          />
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
            onPress={() => router.replace('/accountList/')}
          />
        </SSVStack>
      </SSVStack>
      <SSWarningModal
        visible={warningModalVisible}
        onClose={() => setWarningModalVisible(false)}
      >
        <SSVStack itemsCenter>
          <SSHStack>
            <Image
              style={{ width: 30, height: 30 }}
              source={require('@/assets/icons/check-circle.svg')}
            />
            <SSText size="3xl">
              {accountStore.currentAccount.seedWordCount}{' '}
              {i18n.t('common.of').toLowerCase()}{' '}
              {accountStore.currentAccount.seedWordCount}
            </SSText>
          </SSHStack>
          <SSText uppercase>
            {i18n.t('bitcoin.notYourKeys')}
            {'\n'}
            {i18n.t('bitcoin.notYourCoins')}
          </SSText>
          <SSText size="6xl">{i18n.t('common.warning')}</SSText>
          <Image
            style={{ width: 210, height: 132 }}
            source={require('@/assets/icons/hide-warning.svg')}
          />
          <SSText size="2xl" center style={{ maxWidth: 260 }}>
            {i18n.t('addMasterKey.confirmSeed.warningModal.warning')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {i18n.t('addMasterKey.confirmSeed.warningModal.disclaimer1')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {i18n.t('addMasterKey.confirmSeed.warningModal.disclaimer2')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {i18n.t('addMasterKey.confirmSeed.warningModal.disclaimer3')}
          </SSText>
        </SSVStack>
      </SSWarningModal>
    </SSMainLayout>
  )
}
