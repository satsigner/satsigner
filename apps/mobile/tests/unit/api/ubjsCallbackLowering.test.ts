import {
  Cursor,
  FfiConverterObjectWithCallbacks,
  FfiConverterOptional,
  FfiConverterUInt64
} from '@ubjs/core'

// The BDK scans take their progress inspector as an optional argument, which
// the runtime writes into a buffer instead of lowering it directly.
type ProgressInspector = { inspect: (visited: bigint) => void }

function inspectorConverter() {
  return new FfiConverterObjectWithCallbacks<ProgressInspector>({
    bless: jest.fn(),
    clonePointer: jest.fn(),
    create: jest.fn(),
    freePointer: jest.fn(),
    isConcreteType: (_obj: unknown): _obj is ProgressInspector => false,
    pointer: jest.fn(),
    unbless: jest.fn()
  })
}

function allocate(size: number) {
  return new Uint8Array(size)
}

describe('@ubjs/core callback objects in a buffer', () => {
  it('writes a JS inspector as a handle Rust can call back', () => {
    const converter = inspectorConverter()
    const inspector = { inspect: jest.fn() }

    const buffer = new FfiConverterOptional(converter).lower(
      inspector,
      allocate
    )

    const cursor = Cursor.fromUint8Array(buffer)
    expect(cursor.readU8()).toBe(1)
    const handle = FfiConverterUInt64.readFromCursor(cursor)
    expect(converter.lift(handle)).toBe(inspector)
    expect(converter.drop(handle)).toBe(inspector)
  })

  it('still writes no inspector as an empty optional', () => {
    const buffer = new FfiConverterOptional(inspectorConverter()).lower(
      undefined,
      allocate
    )

    expect([...buffer]).toStrictEqual([0])
  })
})
