import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx'
})

export default withNextra({
  basePath: '/satsigner',
  images: { unoptimized: true },
  output: 'export',
  reactStrictMode: true,
  webpack(config) {
    const allowedSvgRegex = /components\/icons\/.+\.svg$/

    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg')
    )
    fileLoaderRule.exclude = allowedSvgRegex

    config.module.rules.push({
      test: allowedSvgRegex,
      use: ['@svgr/webpack']
    })
    return config
  }
})
