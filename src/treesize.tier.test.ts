import { describe, it } from 'node:test'
import { assertEquals } from '@std/assert'
import { defaults } from './config.ts'
import type { Changes } from './uncommitted.check.ts'
import { decide, rankOf, tierFor } from './treesize.tier.ts'

const tiers = defaults.treesize.tiers

const tree = (fileCount: number, lineCount: number): Changes => {
  return { fileCount, insertions: lineCount, deletions: 0 }
}

const nameOf = (fileCount: number, lineCount: number): string => {
  return tierFor(tree(fileCount, lineCount), tiers)?.name ?? ''
}

const headlineOf = (fileCount: number, lineCount: number, last: string): string => {
  const [first] = decide(tree(fileCount, lineCount), last, tiers).announcement?.lines ?? []

  return first ?? ''
}

describe('All Treesize Tier Tests', () => {
  describe('reaching a tier', () => {
    it('reaches no tier while the tree is small', () => {
      // Act
      const reached = tierFor(tree(3, 40), tiers)

      // Assert
      assertEquals(reached, null)
    })

    it('reaches notice at the first thresholds', () => {
      // Act
      const byFiles = nameOf(12, 0)
      const byLines = nameOf(1, 400)

      // Assert
      assertEquals(byFiles, 'notice')
      assertEquals(byLines, 'notice')
    })

    it('reaches warning at the second thresholds', () => {
      // Act
      const byFiles = nameOf(25, 0)
      const byLines = nameOf(1, 900)

      // Assert
      assertEquals(byFiles, 'warning')
      assertEquals(byLines, 'warning')
    })

    it('reaches urgent at the third thresholds', () => {
      // Act
      const byFiles = nameOf(40, 0)
      const byLines = nameOf(1, 1500)

      // Assert
      assertEquals(byFiles, 'urgent')
      assertEquals(byLines, 'urgent')
    })

    it('stays one step below a threshold', () => {
      // Act
      const belowNotice = nameOf(11, 399)
      const belowWarning = nameOf(24, 899)
      const belowUrgent = nameOf(39, 1499)

      // Assert
      assertEquals(belowNotice, '')
      assertEquals(belowWarning, 'notice')
      assertEquals(belowUrgent, 'warning')
    })

    it('takes the higher tier when files and lines disagree', () => {
      // Act
      const byFiles = nameOf(40, 10)
      const byLines = nameOf(2, 1500)

      // Assert
      assertEquals(byFiles, 'urgent')
      assertEquals(byLines, 'urgent')
    })
  })

  describe('ranking', () => {
    it('ranks an unannounced tree below every tier', () => {
      // Act
      const rank = rankOf('', tiers)

      // Assert
      assertEquals(rank, -1)
    })

    it('ranks the tiers in ascending severity', () => {
      // Act
      const ascending = rankOf('notice', tiers) < rankOf('warning', tiers) && rankOf('warning', tiers) < rankOf('urgent', tiers)

      // Assert
      assertEquals(ascending, true)
    })
  })

  describe('announcing once per tier', () => {
    it('says nothing about a tree that reached no tier', () => {
      // Act
      const decision = decide(tree(3, 40), '', tiers)

      // Assert
      assertEquals(decision.announcement, null)
      assertEquals(decision.nextAnnounced, '')
    })

    it('announces the tier the tree just entered', () => {
      // Act
      const headline = headlineOf(12, 0, '')

      // Assert
      assertEquals(headline, 'Commit the finished work before making further edits. 12 files are uncommitted.')
    })

    it('stays silent on a second edit inside the same tier', () => {
      // Act
      const decision = decide(tree(15, 100), 'notice', tiers)

      // Assert
      assertEquals(decision.announcement, null)
      assertEquals(decision.nextAnnounced, 'notice')
    })

    it('announces only the tier reached when two are crossed at once', () => {
      // Act
      const decision = decide(tree(40, 0), 'notice', tiers)

      // Assert
      assertEquals(decision.announcement?.tier, 'urgent')
      assertEquals(decision.announcement?.lines.length, 3)
    })

    it('lowers the stored tier when the tree shrinks into a lower one', () => {
      // Act
      const decision = decide(tree(12, 0), 'urgent', tiers)

      // Assert
      assertEquals(decision.announcement, null)
      assertEquals(decision.nextAnnounced, 'notice')
    })

    it('clears the stored tier when the tree drops under every threshold', () => {
      // Act
      const decision = decide(tree(0, 0), 'urgent', tiers)

      // Assert
      assertEquals(decision.nextAnnounced, '')
    })

    it('announces again after the tree dropped and re-entered a tier', () => {
      // Arrange
      const dropped = decide(tree(0, 0), 'notice', tiers)

      // Act
      const recrossed = decide(tree(12, 0), dropped.nextAnnounced, tiers)

      // Assert
      assertEquals(recrossed.announcement?.tier, 'notice')
    })

    it('never repeats a tier below the one already announced', () => {
      // Act
      const decision = decide(tree(26, 0), 'urgent', tiers)

      // Assert
      assertEquals(decision.announcement, null)
    })
  })

  describe('wording', () => {
    it('names files alone when only the file count trips', () => {
      // Act
      const headline = headlineOf(12, 10, '')

      // Assert
      assertEquals(headline, 'Commit the finished work before making further edits. 12 files are uncommitted.')
    })

    it('names lines alone when only the line count trips', () => {
      // Act
      const headline = headlineOf(2, 400, '')

      // Assert
      assertEquals(headline, 'Commit the finished work before making further edits. 400 changed lines are uncommitted.')
    })

    it('names both when both trip', () => {
      // Act
      const headline = headlineOf(12, 400, '')

      // Assert
      assertEquals(
        headline,
        'Commit the finished work before making further edits. 12 files and 400 changed lines are uncommitted.',
      )
    })

    it('opens every tier headline with its instruction', () => {
      // Act
      const notice = headlineOf(12, 0, '')
      const warning = headlineOf(25, 0, '')
      const urgent = headlineOf(40, 0, '')

      // Assert
      assertEquals(notice.startsWith('Commit the finished work before making further edits.'), true)
      assertEquals(warning.startsWith('Commit the finished work now, before writing anything new.'), true)
      assertEquals(urgent.startsWith('Stop editing and commit the finished work before touching another file.'), true)
    })

    it('gives each tier its own guidance', () => {
      // Act
      const notice = decide(tree(12, 0), '', tiers).announcement?.lines.slice(1)
      const urgent = decide(tree(40, 0), '', tiers).announcement?.lines.slice(1)

      // Assert
      assertEquals(notice?.[0], 'Split the finished part of this work into its own commit before going further.')
      assertEquals(urgent?.[0], 'Stop adding to this tree and commit what is finished.')
    })
  })

  describe('project tiers', () => {
    it('reaches a tier a project defined itself', () => {
      // Arrange
      const custom = [{ name: 'huge', files: 2, lines: 3 }]

      // Act
      const decision = decide(tree(2, 0), '', custom)

      // Assert
      assertEquals(decision.announcement?.tier, 'huge')
    })

    it('gives a project tier the default directive when it has no wording of its own', () => {
      // Arrange
      const custom = [{ name: 'huge', files: 2, lines: 3 }]

      // Act
      const [first] = decide(tree(2, 0), '', custom).announcement?.lines ?? []

      // Assert
      assertEquals(first, 'Commit the finished work before making further edits. 2 files are uncommitted.')
    })
  })
})
