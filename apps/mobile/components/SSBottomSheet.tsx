import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { type ForwardedRef, forwardRef } from 'react'
import { StyleSheet } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { Colors, Layout } from '@/styles'

import SSText from './SSText'

type SSBottomSheetProps = {
  title: string
  snapPoints?: (string | number)[]
  children: React.ReactNode
}

function SSBottomSheet(
  { title, snapPoints = ['50%'], children }: SSBottomSheetProps,
  ref: ForwardedRef<BottomSheetMethods>
) {
  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.background}
      handleStyle={styles.handle}
      style={styles.bottomSheet}
    >
      <BottomSheetScrollView style={styles.scrollView}>
        <SSVStack>
          <SSText weight="bold" uppercase center>
            {title}
          </SSText>
          {children}
        </SSVStack>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.gray[950]
  },
  bottomSheet: {
    borderTopWidth: 1,
    borderRadius: 6,
    borderColor: Colors.white
  },
  handle: {
    display: 'none'
  },
  scrollView: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal
  }
})

export default forwardRef(SSBottomSheet)
