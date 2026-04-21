const stores = new Map<string, Map<string, string | number | boolean>>()

function getStore(id: string) {
  if (!stores.has(id)) {
    stores.set(id, new Map())
  }
  return stores.get(id)!
}

export function createMMKV(config: { id: string }) {
  const store = getStore(config.id)

  return {
    clearAll: () => store.clear(),
    contains: (key: string) => store.has(key),
    delete: (key: string) => store.delete(key),
    getAllKeys: () => [...store.keys()],
    getBoolean: (key: string) => {
      const val = store.get(key)
      return typeof val === 'boolean' ? val : undefined
    },
    getNumber: (key: string) => {
      const val = store.get(key)
      return typeof val === 'number' ? val : undefined
    },
    getString: (key: string) => {
      const val = store.get(key)
      return typeof val === 'string' ? val : undefined
    },
    remove: (key: string) => store.delete(key),
    set: (key: string, value: string | number | boolean) =>
      store.set(key, value)
  }
}
