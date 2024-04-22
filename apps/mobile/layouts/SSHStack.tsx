import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'
import { type HStackGap } from '@/styles/layout'

type SSHStackProps = {
  gap?: HStackGap
  justifyBetween?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSHStack({
  gap = 'md',
  justifyBetween,
  children,
  style
}: SSHStackProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        ...{ gap: Layout.hStack.gap[gap] },
        ...(justifyBetween ? styles.justifyBetween : {})
      },
      style
    )
  }, [gap, justifyBetween, style])

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  justifyBetween: {
    justifyContent: 'space-between'
  }
})
