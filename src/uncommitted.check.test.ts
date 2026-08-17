import { describe, it } from 'node:test'
import { assertEquals } from '@std/assert'
import { defaults } from './config.ts'
import { type Changes, check } from './uncommitted.check.ts'

const thresholds = defaults.uncommitted

const warn = (changes: Changes): string[] => {
  return check(changes, thresholds)
}

const firstLineOf = (changes: Changes): string => {
  const [first] = warn(changes)

  return first ?? ''
}

describe('All Uncommitted Work Tests', () => {
  describe('quiet working trees', () => {
    it('says nothing when neither threshold is reached', () => {
      // Assert
      assertEquals(warn({ fileCount: 3, insertions: 40, deletions: 10 }), [])
    })

    it('says nothing when the tree holds no changes at all', () => {
      // Assert
      assertEquals(warn({ fileCount: 0, insertions: 0, deletions: 0 }), [])
    })
  })

  describe('files threshold', () => {
    it('warns about files alone when only the file count trips', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 15, insertions: 30, deletions: 10 }), 'warning: 15 files are still uncommitted.')
    })

    it('stays quiet one file below the threshold', () => {
      // Assert
      assertEquals(warn({ fileCount: 11, insertions: 0, deletions: 0 }), [])
    })

    it('warns at exactly the file threshold', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 12, insertions: 0, deletions: 0 }), 'warning: 12 files are still uncommitted.')
    })
  })

  describe('lines threshold', () => {
    it('warns about lines alone when only the line count trips', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 2, insertions: 400, deletions: 157 }), 'warning: 557 changed lines are still uncommitted.')
    })

    it('stays quiet one line below the threshold', () => {
      // Assert
      assertEquals(warn({ fileCount: 1, insertions: 300, deletions: 99 }), [])
    })

    it('warns at exactly the line threshold', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 1, insertions: 300, deletions: 100 }), 'warning: 400 changed lines are still uncommitted.')
    })

    it('sums insertions and deletions toward the threshold', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 1, insertions: 200, deletions: 200 }), 'warning: 400 changed lines are still uncommitted.')
    })
  })

  describe('both thresholds', () => {
    it('names files and lines together when both trip', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 15, insertions: 400, deletions: 157 }), 'warning: 15 files and 557 changed lines are still uncommitted.')
    })

    it('returns the same guidance lines below the first', () => {
      // Assert
      assertEquals(warn({ fileCount: 15, insertions: 400, deletions: 157 }).slice(1), [
        'Split the remaining work into focused commits before starting anything new.',
        'Run git status to see what is left.',
      ])
    })
  })

  describe('singular wording', () => {
    it('writes a lone changed file without a plural s', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 1, insertions: 400, deletions: 0 }), 'warning: 400 changed lines are still uncommitted.')
    })

    it('counts one file toward a warning the line count trips', () => {
      // Assert
      assertEquals(firstLineOf({ fileCount: 12, insertions: 400, deletions: 0 }), 'warning: 12 files and 400 changed lines are still uncommitted.')
    })
  })

  describe('project thresholds', () => {
    it('warns at a threshold a project lowered', () => {
      // Act
      const [first] = check({ fileCount: 2, insertions: 0, deletions: 0 }, { files: 2, lines: 10000 })

      // Assert
      assertEquals(first, 'warning: 2 files are still uncommitted.')
    })

    it('stays quiet under a threshold a project raised', () => {
      // Assert
      assertEquals(check({ fileCount: 30, insertions: 0, deletions: 0 }, { files: 100, lines: 5000 }), [])
    })
  })
})
