import type BottomSheet from '@gorhom/bottom-sheet'
import BottomSheetModal, {
  BottomSheetBackdrop,
  BottomSheetModalProvider,
  BottomSheetView
} from '@gorhom/bottom-sheet'
import React, { useCallback, useRef } from 'react'
import { StyleSheet } from 'react-native'

import { Colors } from '@/styles'

interface SSBottomSheetProps {
  children: React.ReactNode
  isVisible: boolean
  onClose: () => void
  snapPoints?: string[]
}

export default function SSBottomSheet({
  children,
  isVisible,
  onClose,
  snapPoints = ['50%', '80%']
}: SSBottomSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null)

  React.useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand()
    } else {
      bottomSheetRef.current?.forceClose()
    }
  }, [isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <BottomSheetModalProvider>
      <BottomSheetModal
        ref={bottomSheetRef}
        onClose={onClose}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            pressBehavior="close"
            enableTouchThrough
            onPress={onClose}
          />
        )}
        handleComponent={null}
      >
        <BottomSheetView style={styles.contentContainer}>
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.gray[950]
  }
})
