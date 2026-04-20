import { DimensionValue, StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { hStack, type HStackGap } from '@/styles/layout'
import { range, shuffle } from '@/utils/array'

import SSButton from './SSButton'

type SSKeyboardProps = {
  gap?: HStackGap
  items?: string[]
  nCols?: number
  onClear?: () => void
  onDelete?: () => void
  onPress?: (item: string) => void
  random?: boolean
  withControls?: boolean
}

const BTN_DELETE = 'DEL'
const BTN_CLEAR = 'CLEAR'
const NUMERIC_PAD = [...range(10, 1).map((x) => x.toString()), '0']

export default function SSKeyboard({
  onClear,
  onDelete,
  onPress,
  gap = 'xs',
  items = NUMERIC_PAD,
  nCols = 3,
  withControls = true,
  random = false
}: SSKeyboardProps) {
  const pad = random ? shuffle(items) : items
  const nRows = Math.ceil(pad.length / nCols)
  const cellWidth: DimensionValue = `${Math.floor(100 / nCols)}%`

  // control buttons are DELETE and CLEAR
  if (withControls) {
    // for 3 columns, place controls at bottom left and bottom right
    if (nCols === 3) {
      const lastItem = pad.pop()
      pad.push(BTN_CLEAR)
      pad.push(lastItem || '')
      pad.push(BTN_DELETE)
    }
    // else, just place them at bottom right
    else {
      pad.push(BTN_CLEAR)
      pad.push(BTN_DELETE)
    }
  }

  function handleOnPress(item: string) {
    switch (item) {
      case BTN_DELETE:
        if (onDelete) {
          onDelete()
        }
        break
      case BTN_CLEAR:
        if (onClear) {
          onClear()
        }
        break
      default:
        if (onPress) {
          onPress(item)
        }
    }
  }

  function SSKeyboardItem({ index }: { index: number }) {
    if (index >= pad.length) {
      return null
    }

    const item = pad[index]

    return (
      <View
        style={{
          padding: hStack['gap'][gap],
          width: cellWidth
        }}
      >
        <SSButton
          key={index}
          label={item}
          onPress={() => handleOnPress(item)}
        />
      </View>
    )
  }

  return (
    <View>
      {range(nRows).map((i) => (
        <SSHStack key={i} style={styles.row}>
          {range(nCols).map((j) => (
            <SSKeyboardItem index={i * nCols + j} key={i * nCols + j} />
          ))}
        </SSHStack>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'center',
    flexWrap: 'wrap',
    gap: 0,
    justifyContent: 'space-between'
  }
})
