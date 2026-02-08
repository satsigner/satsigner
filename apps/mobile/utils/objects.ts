export function updateNestedObject(
  object: Record<string, any>,
  key: string,
  value: any
) {
  return {
    ...object,
    [key]: value
  }
}

export function updateNestedObjectPartially(
  parentObject: Record<string, Record<string, any>>,
  objectKey: string,
  key: string | string[],
  value: any | any[]
) {
  const nestedObject = parentObject[objectKey]
  const keys = typeof key === 'string' ? [key] : key
  const values = typeof key === 'string' ? [value] : value
  const partialValueToUpdate = keys.reduce(
    (partialObject, key, index) => ({
      ...partialObject,
      [key]: values[index]
    }),
    {}
  )
  const newNestedObject = { ...nestedObject, ...partialValueToUpdate }
  return updateNestedObject(parentObject, objectKey, newNestedObject)
}
