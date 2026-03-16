import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const IGNORE_DIRS = new Set(['.git', '.next', 'node_modules'])
const IGNORE_FILES = new Set(['scripts/check-branding.mjs'])
const LEGACY_UPPER = ['J', 'V', 'F'].join('')
const LEGACY_LOWER = LEGACY_UPPER.toLowerCase()
const PATTERNS = [
  new RegExp(`\\b${LEGACY_UPPER}\\b`, 'g'),
  new RegExp(`${LEGACY_UPPER} Inversiones`, 'gi'),
  new RegExp(`${LEGACY_LOWER}-loan-calculator`, 'g'),
  new RegExp(`${LEGACY_LOWER}_clients`, 'g'),
  new RegExp(`${LEGACY_LOWER}-comprobantes`, 'g'),
  new RegExp(`db\\('${LEGACY_LOWER}'\\)`, 'g'),
  new RegExp(`/${LEGACY_LOWER}\\b`, 'g'),
]

const findings = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(ROOT, fullPath).replace(/\\/g, '/')

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walk(fullPath)
      continue
    }

    if (IGNORE_FILES.has(relativePath)) continue

    const buffer = fs.readFileSync(fullPath)
    if (buffer.includes(0)) continue

    const content = buffer.toString('utf8')
    for (const pattern of PATTERNS) {
      if (pattern.test(content)) {
        findings.push(relativePath)
        break
      }
    }
  }
}

walk(ROOT)

if (findings.length > 0) {
  console.error('Legacy branding references found:')
  for (const finding of findings.sort()) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Branding check passed: no legacy branding references found.')
