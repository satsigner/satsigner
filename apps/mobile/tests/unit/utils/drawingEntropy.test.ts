import {
  distanceBetweenPoints,
  drawingPointsToBinary,
  estimatedDrawingBits,
  getDrawingEntropyProgress,
  hexToBinary,
  serializeDrawingPoints,
  shouldAcceptDrawingSample,
  type DrawingPoint
} from '@/utils/drawingEntropy'

function point(x: number, y: number, t = 0): DrawingPoint {
  return { t, x, y }
}

describe('drawingEntropy', () => {
  describe('shouldAcceptDrawingSample', () => {
    it('accepts the first sample', () => {
      expect(shouldAcceptDrawingSample(null, { x: 10, y: 10 })).toBe(true)
    })

    it('rejects samples closer than the minimum distance', () => {
      expect(
        shouldAcceptDrawingSample({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)
      ).toBe(false)
    })

    it('accepts samples at or beyond the minimum distance', () => {
      expect(
        shouldAcceptDrawingSample({ x: 0, y: 0 }, { x: 6, y: 8 }, 10)
      ).toBe(true)
    })
  })

  describe('distanceBetweenPoints', () => {
    it('returns the euclidean distance', () => {
      expect(distanceBetweenPoints({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    })
  })

  describe('estimatedDrawingBits', () => {
    it('counts one bit per sample', () => {
      expect(estimatedDrawingBits(128)).toBe(128)
    })
  })

  describe('serializeDrawingPoints', () => {
    it('serializes points deterministically', () => {
      expect(serializeDrawingPoints([point(1.234, 5.678, 9)])).toBe(
        '1.23,5.68,9'
      )
    })
  })

  describe('hexToBinary', () => {
    it('converts hex to a binary string', () => {
      expect(hexToBinary('f0')).toBe('11110000')
    })
  })

  describe('drawingPointsToBinary', () => {
    it('returns a binary string of the requested length', () => {
      const points = Array.from({ length: 128 }, (_, i) =>
        point(i, i * 2, i * 3)
      )
      const bits = drawingPointsToBinary(points, 128)
      expect(bits).toHaveLength(128)
      expect(bits).toMatch(/^[01]+$/)
    })

    it('is deterministic for the same points', () => {
      const points = [point(12, 34, 56), point(78, 90, 12)]
      expect(drawingPointsToBinary(points, 128)).toBe(
        drawingPointsToBinary(points, 128)
      )
    })

    it('changes when points change', () => {
      const a = drawingPointsToBinary([point(1, 2, 3)], 128)
      const b = drawingPointsToBinary([point(1, 2, 4)], 128)
      expect(a).not.toBe(b)
    })

    it('rejects invalid bit lengths', () => {
      expect(() => drawingPointsToBinary([point(1, 2, 3)], 100)).toThrow(
        /Invalid Entropy/
      )
    })
  })

  describe('getDrawingEntropyProgress', () => {
    it('reports incomplete progress below the bit length', () => {
      expect(getDrawingEntropyProgress(40, 128)).toEqual({
        complete: false,
        estimatedBits: 40
      })
    })

    it('reports complete when samples cover the bit length', () => {
      expect(getDrawingEntropyProgress(128, 128)).toEqual({
        complete: true,
        estimatedBits: 128
      })
    })
  })
})
