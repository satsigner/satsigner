import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  head: () => {
    return (
      <>
        <link rel="icon" href="/favicon.png" />
      </>
    )
  },
  logo: <span>SatSigner</span>,
  project: {
    link: 'https://github.com/satsigner/satsigner'
  },
  docsRepositoryBase: 'https://github.com/satsigner/satsigner/apps/docs',
  feedback: {
    content: null
  },
  footer: {
    text: 'SatSigner'
  }
}

export default config
