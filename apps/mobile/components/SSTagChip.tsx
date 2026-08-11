import { StyleSheet } from 'react-native'

import { Colors } from '@/styles'

import SSText from './SSText'

type SSTagChipProps = {
  tag: string
}

function SSTagChip({ tag }: SSTagChipProps) {
  return (
    <SSText size="xxs" uppercase numberOfLines={1} style={styles.tag}>
      {tag}
    </SSText>
  )
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray[700],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  }
})

export default SSTagChip
