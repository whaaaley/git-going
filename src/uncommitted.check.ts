/**
 * Decides whether an uncommitted working tree is large enough to warn about.
 *
 * The warning is advice, not a gate. The `uncommitted` command prints it from
 * the `post-commit` and `post-rewrite` git hooks and always exits 0.
 *
 * @example
 * ```ts
 * import { check } from '@whaaaley/git-going/check'
 * import { defaults } from '@whaaaley/git-going/config'
 *
 * const lines = check({ fileCount: 20, insertions: 500, deletions: 30 }, defaults.uncommitted)
 *
 * for (const line of lines) console.error(line)
 * ```
 *
 * @module
 */

import type { UncommittedConfig } from './config.ts'
import { pluralize } from './utils/pluralize.utils.ts'

/**
 * A count of the work sitting in a working tree.
 *
 * These are tracked changes between the working tree and `HEAD`. Untracked
 * files are not counted, so a tree full of new files git has never seen reads
 * as empty.
 */
export type Changes = {
  fileCount: number
  insertions: number
  deletions: number
}

/**
 * Builds the warning for a working tree that has grown too large to leave
 * uncommitted.
 *
 * A tree trips when either the file count or the combined insertion and
 * deletion count reaches its threshold. The two are independent, so a small
 * edit spread across many files trips as readily as a large edit to one.
 *
 * @param changes The tracked changes between the working tree and `HEAD`.
 * @param thresholds The file and line counts at which to warn.
 * @returns The warning as separate lines, ready to print, or an empty array when neither threshold is reached.
 */
export const check = (changes: Changes, thresholds: UncommittedConfig): string[] => {
  const { fileCount, insertions, deletions } = changes
  const lineCount = insertions + deletions

  const filesTripped = fileCount >= thresholds.files
  const linesTripped = lineCount >= thresholds.lines

  if (!filesTripped && !linesTripped) return []

  const files = pluralize('file', fileCount)
  const lines = pluralize('changed line', lineCount)

  let subject = lines
  let isSingular = lineCount === 1

  if (filesTripped && linesTripped) {
    subject = `${files} and ${lines}`
    isSingular = false
  } else if (filesTripped) {
    subject = files
    isSingular = fileCount === 1
  }

  return [
    `warning: ${subject} ${isSingular ? 'is' : 'are'} still uncommitted.`,
    'Split the remaining work into focused commits before starting anything new.',
    'Run git status to see what is left.',
  ]
}
