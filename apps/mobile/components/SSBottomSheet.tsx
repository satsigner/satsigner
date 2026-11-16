import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView
} from '@gorhom/bottom-sheet'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { StyleSheet } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { Colors, Layout } from '@/styles'

import SSText from './SSText'

type SSBottomSheetProps = {
  title: string
  snapPoints?: (string | number)[]
  paddingX?: boolean
  // Off for content with its own vertical gestures, such as wheel pickers,
  // so the sheet stops claiming swipes that start on the content.
  scrollable?: boolean
  children: React.ReactNode
  ref?: React.Ref<BottomSheetMethods>
  onClose?: () => void
}

function SSBottomSheet({
  title,
  snapPoints = ['50%'],
  paddingX = true,
  scrollable = true,
  children,
  ref,
  onClose
}: SSBottomSheetProps) {
  const contentPadding = {
    paddingHorizontal: paddingX ? Layout.mainContainer.paddingHorizontal : 0
  }
  const content = (
    <SSVStack>
      <SSText uppercase center>
        {title}
      </SSText>
      {children}
    </SSVStack>
  )

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableContentPanningGesture={scrollable}
      onClose={onClose}
      backgroundStyle={styles.background}
      handleStyle={styles.handle}
      style={styles.bottomSheet}
    >
      {scrollable ? (
        <BottomSheetScrollView style={[styles.scrollView, contentPadding]}>
          {content}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={[styles.scrollView, contentPadding]}>
          {content}
        </BottomSheetView>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.gray[950]
  },
  bottomSheet: {
    borderColor: Colors.gray[500],
    borderRadius: 6,
    borderTopWidth: 1
  },
  handle: {
    display: 'none'
  },
  scrollView: {
    flex: 1,
    paddingTop: 16
  }
})

export default SSBottomSheet
