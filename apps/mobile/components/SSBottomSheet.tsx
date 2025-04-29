import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { type ForwardedRef, forwardRef } from 'react'

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
      backgroundStyle={{ backgroundColor: Colors.gray[950] }}
      handleStyle={{ display: 'none' }}
    >
      <BottomSheetScrollView
        style={{
          flex: 1,
          paddingTop: 16,
          paddingHorizontal: Layout.mainContainer.paddingHorizontal
        }}
      >
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

export default forwardRef(SSBottomSheet)
