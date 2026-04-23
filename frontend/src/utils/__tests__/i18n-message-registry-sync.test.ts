import { readdirSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveMessageNamespace } from '../../i18n/message-registry'

const SRC_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const APP_I18N_IMPORT = '@/i18n/app'

const walkFiles = (dir: string): string[] => {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'i18n') {
        return []
      }
      return walkFiles(entryPath)
    }

    return ['.vue'].includes(extname(entry.name)) ? [entryPath] : []
  })
}

const extractObjectLiteral = (source: string, marker: string): string | null => {
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) return null

  const braceStart = source.indexOf('{', markerIndex)
  if (braceStart === -1) return null

  let depth = 0
  let quote: '"' | "'" | '`' | null = null
  let escaped = false

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(braceStart, index + 1)
      }
    }
  }

  return null
}

const extractMessagesFromVueFile = (filePath: string) => {
  const source = readFileSync(filePath, 'utf8')
  if (!source.includes(APP_I18N_IMPORT) || !source.includes('messages:')) {
    return null
  }

  const messagesLiteral = extractObjectLiteral(source, 'messages:')
  if (!messagesLiteral) {
    return null
  }

  return Function(`return (${messagesLiteral})`)() as Record<string, Record<string, unknown>>
}

describe('message registry sync', () => {
  it('keeps every component-local messages object aligned with the registry', () => {
    const unresolvedNamespaces: string[] = []

    for (const filePath of walkFiles(SRC_ROOT)) {
      const messages = extractMessagesFromVueFile(filePath)
      if (!messages) continue

      if (!resolveMessageNamespace(messages)) {
        unresolvedNamespaces.push(filePath.replace(`${SRC_ROOT}/`, ''))
      }
    }

    expect(
      unresolvedNamespaces,
      `Message registry drift detected in: ${unresolvedNamespaces.join(' | ')}`,
    ).toEqual([])
  })
})
