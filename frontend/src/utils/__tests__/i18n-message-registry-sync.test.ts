import { readdirSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MESSAGE_REGISTRY } from '../../i18n/message-registry'

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

const extractScopedNamespace = (filePath: string) => {
  const source = readFileSync(filePath, 'utf8')
  if (!source.includes(APP_I18N_IMPORT)) {
    return null
  }

  const namespaceMatch = source.match(/useScopedI18n\('([^']+)'\)/)
  return namespaceMatch?.[1] ?? null
}

describe('message registry sync', () => {
  it('keeps every scoped i18n consumer aligned with the registry and removes component-local message blocks', () => {
    const unresolvedNamespaces: string[] = []
    const filesWithLocalMessages: string[] = []

    for (const filePath of walkFiles(SRC_ROOT)) {
      const source = readFileSync(filePath, 'utf8')
      if (!source.includes(APP_I18N_IMPORT)) continue

      if (source.includes('messages:')) {
        filesWithLocalMessages.push(filePath.replace(`${SRC_ROOT}/`, ''))
      }

      const namespace = extractScopedNamespace(filePath)
      if (!namespace) {
        unresolvedNamespaces.push(filePath.replace(`${SRC_ROOT}/`, ''))
        continue
      }

      if (!(namespace in MESSAGE_REGISTRY)) {
        unresolvedNamespaces.push(filePath.replace(`${SRC_ROOT}/`, ''))
      }
    }

    expect(
      unresolvedNamespaces,
      `Message registry drift detected in: ${unresolvedNamespaces.join(' | ')}`,
    ).toEqual([])

    expect(
      filesWithLocalMessages,
      `Component-local messages blocks should be removed from: ${filesWithLocalMessages.join(' | ')}`,
    ).toEqual([])
  })
})
