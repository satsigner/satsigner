/* Shared helpers for the Studio extraction tools.
   TypeScript is loaded from the app repo, so this site needs no npm install. */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'

export function loadTs(appDir) {
  const candidates = [appDir, path.resolve(appDir, '../..')]
  for (const dir of candidates) {
    try {
      return createRequire(path.join(dir, 'package.json'))('typescript')
    } catch {}
  }
  throw new Error(`typescript not found from ${appDir}. Run pnpm install in the app repo.`)
}

export function walk(dir, filter = () => true, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      walk(full, filter, out)
    } else if (filter(full)) out.push(full)
  }
  return out
}

export function writeOut(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  console.log(`  wrote ${path.relative(process.cwd(), file)}`)
}

// Execute a style module (colors.ts, sizes.ts …) with stubbed imports.
export function runModule(ts, file, stubs = {}) {
  const src = fs.readFileSync(file, 'utf8')
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  })
  const module = { exports: {} }
  const req = (id) => {
    if (id in stubs) return stubs[id]
    return new Proxy({}, { get: () => 0 })
  }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: req })
  return module.exports
}

export function loadStyles(ts, appDir) {
  const s = path.join(appDir, 'styles')
  const headerChrome = runModule(ts, path.join(appDir, 'constants/headerChrome.ts'))
  const stubs = { '@/constants/headerChrome': headerChrome, 'react-native': {} }
  const Colors = runModule(ts, path.join(s, 'colors.ts'), stubs)
  const Sizes = runModule(ts, path.join(s, 'sizes.ts'), stubs)
  const Layout = runModule(ts, path.join(s, 'layout.ts'), stubs)
  const Typography = runModule(ts, path.join(s, 'typography.ts'), stubs)
  return { Colors, Sizes, Layout, Typography }
}

// '#a0a0a0' -> 'var(--gray-100)' using the extracted colour table.
export function colorIndex(Colors) {
  const map = new Map()
  for (const [k, v] of Object.entries(Colors)) {
    if (typeof v === 'string') map.set(v.toLowerCase(), `--${kebab(k)}`)
    else if (v && typeof v === 'object')
      for (const [k2, v2] of Object.entries(v))
        if (typeof v2 === 'string' && !map.has(v2.toLowerCase())) map.set(v2.toLowerCase(), `--${kebab(k)}-${kebab(k2)}`)
  }
  return map
}

export const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
