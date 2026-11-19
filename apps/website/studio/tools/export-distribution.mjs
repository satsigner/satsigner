// Raster every Distribution artboard and write the files the site can serve.
//
//   python3 -m http.server 8000          (from the repo root)
//   node studio/tools/export-distribution.mjs [--base http://localhost:8000]
//
// Needs a local Chrome and playwright-core, which is not a repo dependency:
// run `npm i --no-save playwright-core` at the repo root (node_modules is
// gitignored), or point PLAYWRIGHT_CORE at an existing install.
//
// Output lands in studio/generated/distribution/. Commit it. After deploy,
// each file is at /studio/generated/distribution/<name>.jpg (and .png).
// manifest.json lists every file, its pixel size, and that public path.
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'

const studio = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(studio, '..')
const outDir = join(studio, 'generated', 'distribution')
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name)
  return i === -1 ? fallback : args[i + 1]
}

const TYPES = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.woff2': 'font/woff2'
}

function contentType(path) {
  const dot = path.lastIndexOf('.')
  return TYPES[dot === -1 ? '' : path.slice(dot)] || 'application/octet-stream'
}

async function serve(root) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    let path = decodeURIComponent(url.pathname)
    if (path.endsWith('/')) path += 'index.html'
    const file = join(root, path)
    if (!file.startsWith(root)) {
      res.writeHead(403)
      res.end()
      return
    }
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': contentType(file) })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return { server, base: 'http://127.0.0.1:' + port }
}

let chromium
try {
  ;({ chromium } = process.env.PLAYWRIGHT_CORE
    ? createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE)
    : await import('playwright-core'))
} catch {
  console.error('playwright-core not found. Run `npm i --no-save playwright-core` at the repo root.')
  process.exit(1)
}

const started = opt('base') ? null : await serve(repo)
const base = opt('base', started.base)
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(180000)
await page.goto(base + '/studio/?view=distribution', { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('#distribution-view .promo-board').length > 0)
await page.evaluate(() => document.fonts.ready)

const index = await page.evaluate(() => {
  const boards = [...document.querySelectorAll('#distribution-view .promo-board')]
  const marks = [...document.querySelectorAll('#distribution-view .promo-mark')]
  const assets = [...document.querySelectorAll('#distribution-view a[data-asset]')]
  return {
    boards: boards.map((board) => ({
      file: board.dataset.file,
      w: Number(board.dataset.w),
      h: Number(board.dataset.h),
      caption: board.dataset.caption || ''
    })),
    marks: marks.map((mark) => ({ file: mark.dataset.file, caption: mark.alt || '' })),
    assets: assets.map((link) => ({ file: link.dataset.asset, href: link.getAttribute('href') })),
    markdown: storeMarkdown()
  }
})

await mkdir(outDir, { recursive: true })
const manifest = []

async function save(name, base64, meta) {
  const bytes = Buffer.from(base64, 'base64')
  await writeFile(join(outDir, name), bytes)
  manifest.push({
    file: name,
    path: '/studio/generated/distribution/' + name,
    bytes: bytes.length,
    ...meta
  })
  console.log(name)
}

for (let i = 0; i < index.boards.length; i++) {
  const meta = index.boards[i]
  const rendered = await page.evaluate(async (i) => {
    const board = document.querySelectorAll('#distribution-view .promo-board')[i]
    const hideAgain = reveal(board)
    try {
      if (!board.querySelector('canvas.promo-glow')) paintGlow(board)
      const canvas = await boardCanvas(board, 1)
      const jpg = await canvasBlob(canvas, 'image/jpeg', 0.92)
      const png = await canvasBlob(canvas, 'image/png')
      const encode = async (blob) => bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
      return { jpg: await encode(jpg), png: await encode(png) }
    } finally {
      hideAgain()
    }
  }, i)
  await save(meta.file + '.jpg', rendered.jpg, { w: meta.w, h: meta.h, caption: meta.caption, kind: 'board' })
  await save(meta.file + '.png', rendered.png, { w: meta.w, h: meta.h, caption: meta.caption, kind: 'board' })
}

for (let i = 0; i < index.marks.length; i++) {
  const meta = index.marks[i]
  const rendered = await page.evaluate(async (i) => {
    const mark = document.querySelectorAll('#distribution-view .promo-mark')[i]
    const shot = await markCanvas(mark, 1)
    const jpg = await canvasBlob(flatten(shot.canvas, '#000'), 'image/jpeg', 0.92)
    const png = await canvasBlob(shot.canvas, 'image/png')
    const encode = async (blob) => bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
    return {
      jpg: await encode(jpg),
      png: await encode(png),
      w: Math.round(shot.width),
      h: Math.round(shot.height)
    }
  }, i)
  await save(meta.file + '.jpg', rendered.jpg, { w: rendered.w, h: rendered.h, caption: meta.caption, kind: 'mark' })
  await save(meta.file + '.png', rendered.png, { w: rendered.w, h: rendered.h, caption: meta.caption, kind: 'mark' })
}

for (const asset of index.assets) {
  const response = await fetch(new URL(asset.href, base))
  if (!response.ok) throw new Error('Could not fetch ' + asset.href)
  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFile(join(outDir, asset.file), bytes)
  manifest.push({
    file: asset.file,
    path: '/studio/generated/distribution/' + asset.file,
    bytes: bytes.length,
    kind: 'asset'
  })
  console.log(asset.file)
}

await writeFile(join(outDir, 'store-text.md'), index.markdown)
manifest.push({
  file: 'store-text.md',
  path: '/studio/generated/distribution/store-text.md',
  bytes: Buffer.byteLength(index.markdown),
  kind: 'text'
})

await writeFile(join(outDir, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), files: manifest }, null, 2) + '\n')
console.log(outDir)

await browser.close()
if (started) started.server.close()
