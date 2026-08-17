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

    it('names a tier missing its name', () => {
      // Assert
      assertThrows(() => merge({ treesize: { tiers: [{ files: 5 }] } }), ConfigError, 'treesize.tiers[0].name must be a string')
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
