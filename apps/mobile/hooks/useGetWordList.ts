import { useSettingsStore } from '@/store/settings'
import { getWordList } from '@/utils/bip39'

export const useGetWordList = () => {
  const wordList = useSettingsStore((state) => state.mnemonicWordList)

  return getWordList(wordList)
}
