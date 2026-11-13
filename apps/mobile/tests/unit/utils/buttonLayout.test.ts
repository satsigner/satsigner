import { StyleSheet } from 'react-native'

import { isSizedByContent } from '@/utils/buttonLayout'

const { BUTTON_BASE } = StyleSheet.create({
  BUTTON_BASE: { height: 58, width: '100%' }
})

describe('isSizedByContent', () => {
  it('is false for a button with a fixed width and height', () => {
    expect(isSizedByContent(BUTTON_BASE)).toBe(false)
  })

  it('is false when only flex or margins change', () => {
    expect(isSizedByContent([BUTTON_BASE, { flex: 1 }])).toBe(false)
    expect(isSizedByContent([BUTTON_BASE, { marginTop: 10 }])).toBe(false)
    expect(isSizedByContent([BUTTON_BASE, false, null, undefined])).toBe(false)
  })

  it('is false for an explicit width', () => {
    expect(isSizedByContent([BUTTON_BASE, { width: 200 }])).toBe(false)
    expect(isSizedByContent([BUTTON_BASE, { width: '48%' }])).toBe(false)
  })

  it('is true when a style clears the width', () => {
    expect(isSizedByContent([BUTTON_BASE, { width: undefined }])).toBe(true)
    expect(
      isSizedByContent([
        BUTTON_BASE,
        { alignSelf: 'flex-start', width: undefined }
      ])
    ).toBe(true)
  })

  it('is true for an auto width or height', () => {
    expect(isSizedByContent([BUTTON_BASE, { width: 'auto' }])).toBe(true)
    expect(isSizedByContent([BUTTON_BASE, { height: 'auto' }])).toBe(true)
    expect(
      isSizedByContent([BUTTON_BASE, { height: 'auto', width: 'auto' }])
    ).toBe(true)
  })

  it('reads styles created with StyleSheet', () => {
    const styles = StyleSheet.create({
      addButton: { paddingHorizontal: 16, width: 'auto' }
    })
    expect(isSizedByContent([BUTTON_BASE, styles.addButton])).toBe(true)
  })
})
