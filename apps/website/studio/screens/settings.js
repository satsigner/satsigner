/* Settings — app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/*
   Registered with registerScreen() from screens.js. Ids are `settings` and `settings-<route>`. */

// Fixture app settings (mirrors store/settings.ts and friends).
const appSettings = {
  network: 'signet',
  fiat: 'USD',
  showCurrentFiat: true
}

// settings/index.tsx
registerScreen('settings', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/index.tsx',
  title: () => t('settings.title'),
  back: () => settingsReturn,
  render: () =>
    `<div class="settings-root">${ss.vstack({ gap: 'none' },
      ss.settingsCard({ title: t('settings.network.title'), description: t('settings.network.description'), icon: ss.icon('network', { size: 24 }), go: 'settings-network' }),
      ss.settingsCard({ title: t('settings.ark.title'), description: t('settings.ark.description'), icon: ss.icon('triangle', { size: 24 }), go: 'settings-ark' }),
      ss.settingsCard({ title: t('settings.features.title'), description: t('settings.features.description'), icon: ss.icon('feature', { size: 24 }), go: 'settings-features' }),
      appSettings.showCurrentFiat
        ? ss.settingsCard({ title: t('settings.fiat.title'), description: t('settings.fiat.description'), icon: ss.icon('fiat', { width: 24, height: 16 }), go: 'settings-fiat' })
        : '',
      ss.settingsCard({ title: t('settings.security.title'), description: t('settings.security.description'), icon: ss.icon('lock', { width: 24, height: 32 }), go: 'settings-security' }),
      ss.settingsCard({ title: t('settings.about.title'), description: t('settings.about.description'), icon: ss.icon('about', { size: 26 }), go: 'settings-about' }),
      ss.settingsCard({ title: t('settings.developer.title'), description: t('settings.developer.description'), icon: ss.icon('dev', { size: 24 }), go: 'settings-developer' }))}</div>`
})
