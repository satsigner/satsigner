import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { type WordList, WORDLIST_LIST } from '@/utils/bip39'

const tn = _tn('settings.features.bip39')

export default function Bip39() {
  const [mnemonicWordList, setMnemonicWordList] = useSettingsStore(
    useShallow((state) => [state.mnemonicWordList, state.setMnemonicWordList])
  )

  const [localWordList, setLocalWordList] = useState<WordList>(mnemonicWordList)

  function handleOnSave() {
    setMnemonicWordList(localWordList)
    router.back()
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <SSText size="md">{tn('longDescription')}</SSText>
        <ScrollView style={styles.wordListContainer}>
          <SSVStack gap="sm">
            {WORDLIST_LIST.map((wordList: WordList) => (
              <SSCheckbox
                key={wordList}
                label={wordList}
                selected={localWordList === wordList}
                onPress={() => setLocalWordList(wordList)}
              />
            ))}
          </SSVStack>
        </ScrollView>
        <SSVStack gap="sm">
          <SSButton
            variant="secondary"
            label={t('common.save')}
            onPress={handleOnSave}
          />
          <SSButton
            variant="outline"
            label={t('common.cancel')}
            onPress={router.back}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingBottom: 10,
    paddingTop: 0
  },
  wordListContainer: {
    marginVertical: 20
  }
})
