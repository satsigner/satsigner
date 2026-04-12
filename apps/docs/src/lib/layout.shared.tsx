import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

import { appName, gitConfig } from './shared'

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        external: true,
        text: 'Contact ↗',
        url: 'https://twitter.com/satsigner'
      }
    ],
    nav: {
      title: appName
    }
  }
}
