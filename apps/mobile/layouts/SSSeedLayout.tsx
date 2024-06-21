import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Sizes } from '@/styles'

const NUMBER_OF_COLUMNS = 3
const HEIGHT_MARGIN = 4.25

type SSSeedLayoutProps = {
  count: 12 | 15 | 18 | 21 | 24
  children: React.ReactNode
}

export default function SSSeedLayout({ count, children }: SSSeedLayoutProps) {
  const containerStyle = useMemo(() => {
    return {
      height:
        (count / NUMBER_OF_COLUMNS) * (Sizes.wordInput.height + HEIGHT_MARGIN)
    }
  }, [count])

  return <View style={[styles.containerBase, containerStyle]}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    flex: 1,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between'
  }
})
