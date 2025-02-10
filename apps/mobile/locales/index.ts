import { I18n } from 'i18n-js'

import en from './en.json'

function generateJson(j: Record<string, any>): Record<string, any> {
  function nestKeys(obj: Record<string, any>): Record<string, any> {
    const nestedObj: Record<string, any> = {}

    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        nestedObj[key] = nestKeys(value)
      } else {
        const keys = key.split('.')
        let current = nestedObj

        keys.forEach((k, index) => {
          if (!current[k]) {
            current[k] = index === keys.length - 1 ? value : {}
          }
          current = current[k]
        })
      }
    })

    return nestedObj
  }

  return nestKeys(j)
}

const i18n = new I18n()

i18n.defaultLocale = 'en'
i18n.locale = 'en'
i18n.enableFallback = true
i18n.defaultSeparator = '.'

i18n.store({ en: generateJson(en) })

const t = (key: string) => i18n.t(key)

export { i18n, t }
