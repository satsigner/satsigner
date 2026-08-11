import {
  deletePinDigit,
  emptyPin,
  fillPinDigit,
  getPinCursorIndex,
  isPinFilled
} from '@/utils/pin'

describe('pin utils', () => {
  describe('fillPinDigit', () => {
    it('fills the first empty cell', () => {
      expect(fillPinDigit(['', '', '', ''], '1')).toStrictEqual([
        '1',
        '',
        '',
        ''
      ])
      expect(fillPinDigit(['1', '', '', ''], '2')).toStrictEqual([
        '1',
        '2',
        '',
        ''
      ])
      expect(fillPinDigit(['1', '2', '3', ''], '4')).toStrictEqual([
        '1',
        '2',
        '3',
        '4'
      ])
    })

    it('is a no-op when the pin is full', () => {
      const pin = ['1', '2', '3', '4']
      expect(fillPinDigit(pin, '5')).toBe(pin)
    })

    it('does not mutate the input array', () => {
      const pin = ['', '', '', '']
      fillPinDigit(pin, '1')
      expect(pin).toStrictEqual(['', '', '', ''])
    })

    it('never skips cells when presses are chained as functional updates', () => {
      // Regression test for the auth screen bug where rapid presses were
      // applied to a stale pin snapshot, leaving gaps like ['1', '', '1', '1'].
      // Chaining each press on the previous result models how React resolves
      // queued functional updaters within a single batch.
      let pin = emptyPin()
      for (const digit of ['1', '1', '1', '1']) {
        pin = fillPinDigit(pin, digit)
      }
      expect(pin).toStrictEqual(['1', '1', '1', '1'])
      expect(pin.join('')).toBe('1111')
    })

    it('keeps digits contiguous regardless of press count', () => {
      let pin = emptyPin()
      pin = fillPinDigit(pin, '1')
      pin = fillPinDigit(pin, '2')
      expect(pin).toStrictEqual(['1', '2', '', ''])
      expect(getPinCursorIndex(pin)).toBe(2)
    })
  })

  describe('deletePinDigit', () => {
    it('clears the last filled cell', () => {
      expect(deletePinDigit(['1', '2', '', ''])).toStrictEqual([
        '1',
        '',
        '',
        ''
      ])
      expect(deletePinDigit(['1', '2', '3', '4'])).toStrictEqual([
        '1',
        '2',
        '3',
        ''
      ])
    })

    it('is a no-op when the pin is empty', () => {
      const pin = ['', '', '', '']
      expect(deletePinDigit(pin)).toBe(pin)
    })

    it('undoes a fill', () => {
      const pin = fillPinDigit(emptyPin(), '7')
      expect(deletePinDigit(pin)).toStrictEqual(emptyPin())
    })
  })

  describe('getPinCursorIndex', () => {
    it('returns the first empty index', () => {
      expect(getPinCursorIndex(['', '', '', ''])).toBe(0)
      expect(getPinCursorIndex(['1', '', '', ''])).toBe(1)
      expect(getPinCursorIndex(['1', '2', '3', ''])).toBe(3)
    })

    it('returns the pin length when full', () => {
      expect(getPinCursorIndex(['1', '2', '3', '4'])).toBe(4)
    })
  })

  describe('isPinFilled', () => {
    it('detects a full pin', () => {
      expect(isPinFilled(['1', '2', '3', '4'])).toBe(true)
      expect(isPinFilled(['1', '2', '3', ''])).toBe(false)
      expect(isPinFilled(['', '', '', ''])).toBe(false)
    })
  })
})
