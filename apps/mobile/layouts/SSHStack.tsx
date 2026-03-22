import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'
import type { HStackGap } from '@/styles/layout'

type SSHStackProps = {
  gap?: HStackGap
  justifyBetween?: boolean
  justifyEvenly?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSHStack({
  gap = 'md',
  justifyBetween,
  justifyEvenly,
  children,
  style
}: SSHStackProps) {
  const containerStyle = useMemo(
    () =>
      StyleSheet.compose(
        {
          ...styles.containerBase,
          gap: Layout.hStack.gap[gap],
          ...(justifyBetween ? styles.justifyBetween : {}),
          ...(justifyEvenly ? styles.justifyEvenly : {})
        },
        style
      ),
    [gap, justifyBetween, justifyEvenly, style]
  )

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  justifyBetween: {
    justifyContent: 'space-between'
  },
  justifyEvenly: {
    justifyContent: 'space-evenly'
  }
})
