import { I18n } from 'i18n-js'

import en from './en.json'

const i18n = new I18n()

i18n.defaultLocale = 'en'
i18n.locale = 'en'
i18n.enableFallback = true
i18n.store(en)

export { i18n }
