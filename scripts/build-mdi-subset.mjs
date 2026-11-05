import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { icons } = require('@iconify-json/mdi')
const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/constants/category-icons.ts'), 'utf8')
const names = [...source.matchAll(/'mdi:([^']+)'/g)].map((m) => m[1])
const uniq = [...new Set(names)]
const body = {}
const missing = []
for (const name of uniq) {
  if (icons.icons[name]) body[name] = icons.icons[name]
  else missing.push(name)
}
if (missing.length) {
  console.error('Missing MDI icons:', missing.join(', '))
  process.exit(1)
}
const out = {
  prefix: 'mdi',
  icons: body,
  width: icons.width,
  height: icons.height,
}
const dest = path.join(root, 'src/assets/icons/mdi-subset.json')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out))
console.log(`Wrote ${Object.keys(body).length} icons → ${path.relative(root, dest)}`)
