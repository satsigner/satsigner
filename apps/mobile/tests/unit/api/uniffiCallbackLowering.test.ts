import {
  FfiConverterObjectWithCallbacks,
  FfiConverterOptional,
  type UniffiObjectFactory
} from '@ubjs/core'

type Inspector = { inspect: () => void }

const factory: UniffiObjectFactory<Inspector> = {
  bless: () => ({ markDestroyed: () => undefined }),
  clonePointer: () => 0n,
  create: () => ({ inspect: () => undefined }),
  freePointer: () => undefined,
  isConcreteType: (_obj): _obj is Inspector => false,
  pointer: () => 0n,
  unbless: () => undefined
}

describe('uniffi callback lowering', () => {
  it('lowers an optional JavaScript callback such as a scan inspector', () => {
    const optional = new FfiConverterOptional(
      new FfiConverterObjectWithCallbacks(factory)
    )

    expect(() =>
      optional.lower(
        { inspect: () => undefined },
        (size) => new Uint8Array(size)
      )
    ).not.toThrow()
  })
})
