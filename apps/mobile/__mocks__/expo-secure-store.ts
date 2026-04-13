const store: Record<string, string> = {}

export const __store = store

export const getItemAsync = jest.fn((key: string) =>
  Promise.resolve(store[key] ?? null)
)
export const setItemAsync = jest.fn((key: string, value: string) => {
  store[key] = value
  return Promise.resolve()
})
export const deleteItemAsync = jest.fn((key: string) => {
  delete store[key]
  return Promise.resolve()
})
