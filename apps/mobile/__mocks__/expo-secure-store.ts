const store: Record<string, string> = {}

export const getItemAsync = jest.fn(async (key: string) => store[key] ?? null)
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  store[key] = value
})
export const deleteItemAsync = jest.fn(async (key: string) => {
  delete store[key]
})
