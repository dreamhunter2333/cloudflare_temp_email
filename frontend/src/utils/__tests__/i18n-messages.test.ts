import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

import { describe, expect, it } from 'vitest'

import { getLocalizedSourceMessage } from '../../i18n-messages'

const extractMessages = (content: string) => {
  const idx = content.indexOf('messages:')
  if (idx === -1) return null

  const start = content.indexOf('{', idx)
  let depth = 0
  let inSingle = false
  let inDouble = false
  let inTemplate = false
  let escaped = false

  for (let i = start; i < content.length; i += 1) {
    const ch = content[i]
    const prev = content[i - 1]

    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (!inDouble && !inTemplate && ch === '\'' && prev !== '\\') inSingle = !inSingle
    else if (!inSingle && !inTemplate && ch === '"' && prev !== '\\') inDouble = !inDouble
    else if (!inSingle && !inDouble && ch === '`' && prev !== '\\') inTemplate = !inTemplate

    if (inSingle || inDouble || inTemplate) continue

    if (ch === '{') depth += 1
    if (ch === '}') depth -= 1
    if (depth === 0) return content.slice(start, i + 1)
  }

  return null
}

const getEnglishSourceMessages = () => {
  const repoRoot = path.resolve(process.cwd(), '..')
  const files = execFileSync('rg', ['-l', 'useI18n\\(\\{|messages:\\s*\\{', 'frontend/src'], {
    encoding: 'utf8',
    cwd: repoRoot,
  })
    .trim()
    .split('\n')
    .filter(Boolean)

  const messages = new Set<string>()

  for (const file of files) {
    const content = fs.readFileSync(path.join(repoRoot, file), 'utf8')
    const block = extractMessages(content)
    if (!block) continue

    const parsed = Function(`return (${block})`)() as { en?: Record<string, string> }
    for (const value of Object.values(parsed.en || {})) {
      messages.add(value)
    }
  }

  return [...messages]
}

describe('new locale coverage', () => {
  it('covers every extracted english source message', () => {
    const sources = getEnglishSourceMessages()
    const locales = ['es', 'pt-BR', 'ja', 'de'] as const

    for (const locale of locales) {
      const missing = sources.filter((source) => getLocalizedSourceMessage(locale, source) === undefined)
      expect(missing, `${locale} is missing translations for: ${missing.join(' | ')}`).toEqual([])
    }
  })
})
