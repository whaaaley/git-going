import type { UncommittedConfig } from './config.ts'

// Decides whether an uncommitted working tree is large enough to warn about.

export type Changes = {
  fileCount: number
  insertions: number
  deletions: number
}

const plural = (count: number, noun: string): string => {
  return count === 1 ? `${count} ${noun}` : `${count} ${noun}s`
}

export const check = (changes: Changes, thresholds: UncommittedConfig): string[] => {
  const { fileCount, insertions, deletions } = changes
  const lineCount = insertions + deletions

  const filesTripped = fileCount >= thresholds.files
  const linesTripped = lineCount >= thresholds.lines

  if (!filesTripped && !linesTripped) return []

  const files = plural(fileCount, 'file')
  const lines = plural(lineCount, 'changed line')

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
