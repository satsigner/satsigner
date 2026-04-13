import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import mdx from 'fumadocs-mdx/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

// VITE_BASE_PATH is used when deploying to GitHub Pages (e.g. /satsigner)
const basePath = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base: basePath,
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
    mdx(await import('./source.config')),
    tailwindcss(),
    tanstackStart({
      prerender: {
        crawlLinks: true,
        enabled: true
      }
    }),
    react(),
    // please see https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nitro for guides on hosting
    nitro({
      preset: process.env.NITRO_PRESET ?? 'node-server'
    })
  ],
  resolve: {
    tsconfigPaths: true
  },
  server: {
    port: 3000
  }
})
