import { z } from 'zod'

import { optionalLenient, withFallback } from '@/utils/schema'

describe('withFallback', () => {
  const schema = z.object({ size: withFallback(z.number(), 0) })

  it('keeps values the inner schema accepts', () => {
    expect(schema.parse({ size: 1024 })).toStrictEqual({ size: 1024 })
  })

  it('uses the fallback for unreadable or missing values', () => {
    expect(schema.parse({ size: '1024' })).toStrictEqual({ size: 0 })
    expect(schema.parse({})).toStrictEqual({ size: 0 })
  })
})

describe('optionalLenient', () => {
  const schema = z.object({ name: optionalLenient(z.string()) })

  it('keeps values the inner schema accepts', () => {
    expect(schema.parse({ name: 'photo.png' })).toStrictEqual({
      name: 'photo.png'
    })
  })

  it('drops unreadable values and leaves absent keys absent', () => {
    expect(schema.parse({ name: null })).toStrictEqual({ name: undefined })
    expect(schema.parse({})).toStrictEqual({})
  })
})
