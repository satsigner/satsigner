import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkTheme } from '@storybook/react-native'

import { Colors } from '@/styles'

import { view } from './storybook.requires'

const satsignerTheme = {
  ...darkTheme,
  background: {
    ...darkTheme.background,
    app: Colors.gray[950],
    bar: Colors.gray[950],
    content: Colors.gray[950],
    preview: Colors.gray[950]
  },
  barBg: Colors.gray[950]
}

const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem
  },
  theme: satsignerTheme
})

export default StorybookUIRoot
