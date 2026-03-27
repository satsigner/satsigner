import { I18n, type TranslateOptions } from 'i18n-js'

import en from './en.json'

function generateJson(j: Record<string, unknown>): Record<string, unknown> {
  function nestKeys(obj: Record<string, unknown>): Record<string, unknown> {
    const nestedObj: Record<string, unknown> = {}

    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        nestedObj[key] = nestKeys(value as Record<string, unknown>)
      } else {
        const keys = key.split('.')
        let current = nestedObj

        keys.forEach((k, index) => {
          if (!current[k]) {
            current[k] = index === keys.length - 1 ? value : {}
          }
          current = current[k] as Record<string, unknown>
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

const t = (key: string, options?: TranslateOptions) => i18n.t(key, options)

const tn = (namespace: string) =>
  function (key: string, options?: TranslateOptions) {
    return t(`${namespace}.${key}`, options)
  }

export { i18n, t, tn }
