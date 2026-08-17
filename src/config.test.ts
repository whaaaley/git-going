import { describe, it } from 'node:test'
import { assertEquals, assertThrows } from '@std/assert'
import { ConfigError, defaults, merge, parse } from './config.ts'

describe('All Config Tests', () => {
  describe('defaulting', () => {
    it('returns the defaults for an empty object', () => {
      // Assert
      assertEquals(merge({}), defaults)
    })

    it('keeps the sibling defaults when one field is set', () => {
      // Act
      const config = merge({ uncommitted: { files: 5 } })

      // Assert
      assertEquals(config.uncommitted, { files: 5, lines: defaults.uncommitted.lines })
      assertEquals(config.commit, defaults.commit)
    })

    it('replaces a list rather than appending to it', () => {
      // Act
      const config = merge({ commit: { types: ['feat'] } })

      // Assert
      assertEquals(config.commit.types, ['feat'])
    })

    it('reads the tiers a project defines', () => {
      // Act
      const config = merge({ treesize: { tiers: [{ name: 'huge', files: 5, lines: 50 }] } })

      // Assert
      assertEquals(config.treesize.tiers, [{ name: 'huge', files: 5, lines: 50 }])
    })

    it('keeps a tier that trips on files alone', () => {
      // Act
      const config = merge({ treesize: { tiers: [{ name: 'wide', files: 5 }] } })

      // Assert
      assertEquals(config.treesize.tiers, [{ name: 'wide', files: 5, lines: Number.POSITIVE_INFINITY }])
    })

    it('keeps a tier that trips on lines alone', () => {
      // Act
      const config = merge({ treesize: { tiers: [{ name: 'deep', lines: 50 }] } })

      // Assert
      assertEquals(config.treesize.tiers, [{ name: 'deep', files: Number.POSITIVE_INFINITY, lines: 50 }])
    })

    it('accepts tiers whose thresholds both ascend', () => {
      // Arrange
      const tiers = [{ name: 'notice', files: 5, lines: 50 }, { name: 'urgent', files: 9, lines: 90 }]

      // Act
      const config = merge({ treesize: { tiers } })

      // Assert
      assertEquals(config.treesize.tiers, tiers)
    })

    it('accepts a later tier that holds one threshold level while raising the other', () => {
      // Arrange
      const tiers = [{ name: 'notice', files: 5, lines: 50 }, { name: 'urgent', files: 5, lines: 90 }]

      // Act
      const config = merge({ treesize: { tiers } })

      // Assert
      assertEquals(config.treesize.tiers, tiers)
    })

    // Dropping a threshold raises it to infinity, which puts the tier further out of reach rather than nearer.
    it('accepts a later tier that drops a threshold the tier before it set', () => {
      // Act
      const config = merge({ treesize: { tiers: [{ name: 'notice', files: 5, lines: 50 }, { name: 'urgent', files: 9 }] } })

      // Assert
      assertEquals(config.treesize.tiers, [
        { name: 'notice', files: 5, lines: 50 },
        { name: 'urgent', files: 9, lines: Number.POSITIVE_INFINITY },
      ])
    })
  })

  describe('rejected config', () => {
    it('names an unknown top level key', () => {
      // Assert
      assertThrows(() => merge({ uncomitted: {} }), ConfigError, 'unknown key uncomitted')
    })

    it('names an unknown key inside a section', () => {
      // Assert
      assertThrows(() => merge({ commit: { maxLenght: 72 } }), ConfigError, 'unknown key commit.maxLenght')
    })

    it('names a field of the wrong type', () => {
      // Assert
      assertThrows(() => merge({ uncommitted: { files: 'twelve' } }), ConfigError, 'uncommitted.files must be a number')
    })

    it('names a list holding something other than strings', () => {
      // Assert
      assertThrows(() => merge({ commit: { types: [1, 2] } }), ConfigError, 'commit.types must be an array of strings')
    })

    it('names a type the subject pattern can never match', () => {
      // Assert
      assertThrows(() => merge({ commit: { types: ['wip2'] } }), ConfigError, 'commit.types entry "wip2" is not usable, a type is lowercase letters only')
    })

    it('names a scope the subject pattern can never match', () => {
      // Assert
      assertThrows(() => merge({ commit: { scopes: ['apps/web'] } }), ConfigError, 'commit.scopes entry "apps/web" is not usable, a scope is lowercase letters and dashes only')
    })

    it('names an uncommitted file threshold of zero', () => {
      // Assert
      assertThrows(() => merge({ uncommitted: { files: 0 } }), ConfigError, 'uncommitted.files is not usable, a threshold must be a whole number of at least 1')
    })

    it('names a negative uncommitted line threshold', () => {
      // Assert
      assertThrows(() => merge({ uncommitted: { lines: -1 } }), ConfigError, 'uncommitted.lines is not usable, a threshold must be a whole number of at least 1')
    })

    it('names a max length of zero', () => {
      // Assert
      assertThrows(() => merge({ commit: { maxLength: 0 } }), ConfigError, 'commit.maxLength is not usable, a threshold must be a whole number of at least 1')
    })

    it('names a fractional threshold', () => {
      // Assert
      assertThrows(() => merge({ uncommitted: { files: 2.5 } }), ConfigError, 'uncommitted.files is not usable, a threshold must be a whole number of at least 1')
    })

    it('accepts the degenerate but coherent threshold of one', () => {
      // Act
      const config = merge({ uncommitted: { files: 1, lines: 1 }, commit: { maxLength: 1 } })

      // Assert
      assertEquals(config.uncommitted, { files: 1, lines: 1 })
      assertEquals(config.commit.maxLength, 1)
    })

    it('names a tier missing its name', () => {
      // Assert
      assertThrows(() => merge({ treesize: { tiers: [{ files: 5 }] } }), ConfigError, 'treesize.tiers[0].name must be a string')
    })

    it('names a tier that declares neither threshold', () => {
      // Assert
      assertThrows(
        () => merge({ treesize: { tiers: [{ name: 'ghost' }] } }),
        ConfigError,
        'treesize.tiers entry "ghost" is not usable, a tier needs files or lines to be reachable',
      )
    })

    it('names an unreachable tier by index when it has no name', () => {
      // Assert
      assertThrows(
        () => merge({ treesize: { tiers: [{ name: '' }] } }),
        ConfigError,
        'treesize.tiers entry [0] is not usable, a tier needs files or lines to be reachable',
      )
    })

    it('names a tier that is easier to reach than the one before it', () => {
      // Arrange
      const tiers = [{ name: 'notice', files: 9, lines: 90 }, { name: 'urgent', files: 5, lines: 50 }]

      // Assert
      assertThrows(
        () => merge({ treesize: { tiers } }),
        ConfigError,
        'treesize.tiers entry "urgent" is not usable, a tier must not be easier to reach than "notice" before it',
      )
    })

    it('names a tier whose thresholds move in opposite directions', () => {
      // Arrange
      const tiers = [{ name: 'notice', files: 5, lines: 90 }, { name: 'urgent', files: 9, lines: 50 }]

      // Assert
      assertThrows(
        () => merge({ treesize: { tiers } }),
        ConfigError,
        'treesize.tiers entry "urgent" is not usable, a tier must not be easier to reach than "notice" before it',
      )
    })

    // The first tier leaves lines at infinity, so the second setting a real line count makes it the easier of the two.
    it('names a tier that sets a threshold the tier before it left open', () => {
      // Arrange
      const tiers = [{ name: 'notice', files: 5 }, { name: 'urgent', files: 9, lines: 90 }]

      // Assert
      assertThrows(
        () => merge({ treesize: { tiers } }),
        ConfigError,
        'treesize.tiers entry "urgent" is not usable, a tier must not be easier to reach than "notice" before it',
      )
    })

    it('rejects a file that is not a JSON object', () => {
      // Assert
      assertThrows(() => parse('[1,2,3]'), ConfigError, 'must contain a JSON object')
    })

    it('rejects a file that is not JSON at all', () => {
      // Assert
      assertThrows(() => parse('not json'), ConfigError, 'not valid JSON')
    })
  })
})
