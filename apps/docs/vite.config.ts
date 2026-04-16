import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import mdx from 'fumadocs-mdx/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['micromark-util-symbol'],
    include: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-direction',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      'class-variance-authority',
      'hast-util-to-jsx-runtime',
      'lucide-react',
      'next-themes',
      'rehype-raw',
      'remark-rehype',
      'remark',
      'scroll-into-view-if-needed',
      'tailwind-merge',
      'unist-util-visit',
      'vfile'
    ]
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    mdx(await import('./source.config')),
    tailwindcss(),
    tanstackStart({
      prerender: {
        crawlLinks: true,
        enabled: true
      }
    }),
    react()
  ],
  resolve: {
    tsconfigPaths: true
  },
  server: {
    port: 3000
  }
})
