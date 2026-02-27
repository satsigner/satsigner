import { View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

const SKELETON_COLOR = Colors.gray[700]
const SKELETON_CARD_HEIGHT = 160

function SkeletonBox({
  width,
  height,
  style
}: {
  width: number | string
  height: number
  style?: object
}) {
  return (
    <View
      style={[
        {
          backgroundColor: SKELETON_COLOR,
          borderRadius: 4,
          height,
          width
        },
        style
      ]}
    />
  )
}

export default function SSAccountCardSkeleton() {
  return (
    <SSHStack
      justifyBetween
      style={{ height: SKELETON_CARD_HEIGHT, position: 'relative' }}
    >
      <SSVStack gap="xxs">
        <SkeletonBox width={48} height={10} />
        <SkeletonBox width={120} height={18} style={{ marginTop: 4 }} />
        <SSHStack gap="xs" style={{ alignItems: 'baseline', marginTop: 8 }}>
          <SkeletonBox width={100} height={28} />
          <SkeletonBox width={36} height={20} />
        </SSHStack>
        <SSHStack gap="xs" style={{ marginTop: 6 }}>
          <SkeletonBox width={60} height={14} />
          <SkeletonBox width={40} height={12} />
        </SSHStack>
        <SSHStack gap="md" style={{ marginTop: 16 }}>
          {[60, 50, 55, 50].map((w, i) => (
            <SSVStack gap="none" key={i}>
              <SkeletonBox width={w} height={16} />
              <SkeletonBox
                width={w * 0.8}
                height={10}
                style={{ marginTop: 4 }}
              />
            </SSVStack>
          ))}
        </SSHStack>
      </SSVStack>
      <SkeletonBox width={6} height={12} style={{ alignSelf: 'center' }} />
    </SSHStack>
  )
}
