// Export App Store screenshots from release/shots.html at exact pixel sizes.
//
//   python3 -m http.server 8000          (from the repo root)
//   node release/tools/export-shots.mjs [--base http://localhost:8000] [--format iphone69,header]
//
// Needs a local Chrome and playwright-core, which is not a repo dependency:
// run `npm i --no-save playwright-core` at the repo root (node_modules is
// gitignored), or point PLAYWRIGHT_CORE at an existing install.
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name)
  return i === -1 ? fallback : args[i + 1]
}
const base = opt('base', 'http://localhost:8000')

// data.js assigns window.RELEASE; run it in a sandbox to read the same source the page uses.
const sandbox = { window: {} }
vm.runInNewContext(await readFile(join(root, 'data.js'), 'utf8'), sandbox)
const R = sandbox.window.RELEASE
const wanted = opt('format', R.formats.filter((f) => f.required).map((f) => f.id).join(',')).split(',')

let chromium
try {
  ;({ chromium } = process.env.PLAYWRIGHT_CORE
    ? createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE)
    : await import('playwright-core'))
} catch {
  console.error('playwright-core not found. Run `npm i --no-save playwright-core` at the repo root.')
  process.exit(1)
}

const browser = await chromium.launch({ channel: 'chrome' })
for (const format of R.formats.filter((f) => wanted.includes(f.id))) {
  const count = format.id === 'header' ? 1 : R.shots.length
  const outDir = join(root, 'out', format.id)
  await mkdir(outDir, { recursive: true })
  const page = await browser.newPage({ viewport: { width: format.w, height: format.h }, deviceScaleFactor: 1 })
  for (let i = 0; i < count; i++) {
    const url = `${base}/release/shots.html?export=1&format=${format.id}&slide=${i}`
    await page.goto(url, { waitUntil: 'load' })
    // Studio frames route after DOMContentLoaded and run entry animations.
    for (const frame of page.frames().slice(1)) await frame.waitForLoadState('load')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1500)
    const name = format.id === 'header' ? 'header' : `${String(i + 1).padStart(2, '0')}-${R.shots[i].screen}`
    const file = join(outDir, `${name}.png`)
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: format.w, height: format.h } })
    console.log(file)
  }
  await page.close()
}
await browser.close()
